import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';

/** Claves que podrían alterar prototipos de objetos si algún código las copiara sin cuidado. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function hasForbiddenKey(value: unknown, depth = 0): boolean {
  if (depth > 20 || typeof value !== 'object' || value === null) return false;
  return Object.keys(value).some(
    (key) =>
      FORBIDDEN_KEYS.has(key) ||
      hasForbiddenKey((value as Record<string, unknown>)[key], depth + 1),
  );
}

/**
 * Controles sobre el cuerpo de las peticiones:
 * - Rechaza claves `__proto__`, `constructor` y `prototype` (antes se ignoraban en silencio).
 * - En el panel solo acepta cuerpos JSON (y multipart para las fotos). Un formulario HTML de otro
 *   sitio envía `application/x-www-form-urlencoded`: así la protección contra CSRF no depende
 *   únicamente de la cookie SameSite=Lax.
 */
@Injectable()
export class RequestBodyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    const contentType = request.headers['content-type'] ?? '';
    const hasBody =
      Number(request.headers['content-length'] ?? 0) > 0 ||
      Boolean(request.headers['transfer-encoding']);
    if (
      WRITE_METHODS.has(request.method) &&
      request.path.includes('/admin/') &&
      hasBody &&
      !/^application\/json\b/i.test(contentType) &&
      !/^multipart\/form-data\b/i.test(contentType)
    ) {
      throw new UnsupportedMediaTypeException('El panel solo acepta contenido en formato JSON.');
    }

    if (hasForbiddenKey(request.body)) {
      throw new BadRequestException('El contenido enviado tiene campos no permitidos.');
    }
    return next.handle();
  }
}
