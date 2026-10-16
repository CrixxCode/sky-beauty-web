import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';

/** Forma uniforme de todas las respuestas de error de la API. */
export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/** Códigos de Prisma que corresponden a errores del cliente y no a fallos del servidor. */
const PRISMA_ERROR_STATUS: Record<string, HttpStatus> = {
  P2002: HttpStatus.CONFLICT, // violación de restricción única
  P2003: HttpStatus.CONFLICT, // violación de llave foránea
  P2020: HttpStatus.BAD_REQUEST, // valor fuera del rango del tipo de columna
  P2025: HttpStatus.NOT_FOUND, // registro no encontrado
};

const PRISMA_ERROR_MESSAGES: Partial<Record<string, string>> = {
  P2020: 'Un valor está fuera del rango permitido.',
};

/**
 * Nest convierte el SyntaxError de un JSON mal formado y el URIError de una dirección mal
 * codificada en un 400 con el mensaje original en inglés; se reemplaza por uno en español.
 */
function translateParserMessage(message: string | string[]): string | string[] {
  if (typeof message !== 'string') return message;
  if (/JSON|^Unexpected (token|end|non-whitespace)/.test(message)) {
    return 'El contenido enviado no es un JSON válido.';
  }
  if (/^URI malformed$/.test(message)) return 'La dirección solicitada no es válida.';
  return message;
}

/** Error de lectura del cuerpo de la petición (body-parser de Express), con su propio código 4xx. */
function bodyParserError(exception: unknown): { status: number; type: string } | null {
  if (typeof exception !== 'object' || exception === null) return null;
  const { status, type } = exception as { status?: unknown; type?: unknown };
  if (typeof status !== 'number' || status < 400 || status >= 500) return null;
  if (typeof type !== 'string' || !type.startsWith('entity.')) return null;
  return { status, type };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const { statusCode, message } = this.resolve(exception);
    if (statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const body: ErrorResponseBody = {
      statusCode,
      error: HttpStatus[statusCode] ?? 'ERROR',
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(statusCode).json(body);
  }

  private resolve(exception: unknown): { statusCode: number; message: string | string[] } {
    if (exception instanceof PayloadTooLargeException) {
      return {
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        message: 'El archivo supera el tamaño máximo permitido.',
      };
    }
    // El limitador de peticiones responde en inglés ("ThrottlerException: Too Many Requests").
    if (exception instanceof ThrottlerException) {
      return {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Hiciste demasiadas solicitudes seguidas. Espera unos minutos e intenta de nuevo.',
      };
    }
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      const message =
        typeof res === 'object' && res !== null && 'message' in res
          ? (res as { message: string | string[] }).message
          : exception.message;
      return { statusCode: exception.getStatus(), message: translateParserMessage(message) };
    }

    // JSON mal formado o demasiado grande: Express lo rechaza antes de llegar a Nest.
    const parserError = bodyParserError(exception);
    if (parserError) {
      return {
        statusCode: parserError.status,
        message:
          parserError.type === 'entity.too.large'
            ? 'El contenido enviado supera el tamaño máximo permitido.'
            : parserError.type === 'entity.parse.failed'
              ? 'El contenido enviado no es un JSON válido.'
              : 'La petición no es válida.',
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const statusCode = PRISMA_ERROR_STATUS[exception.code];
      if (statusCode) {
        return {
          statusCode,
          message:
            PRISMA_ERROR_MESSAGES[exception.code] ??
            'La operación entra en conflicto con datos existentes o no encontrados.',
        };
      }
    }

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error interno del servidor.' };
  }
}
