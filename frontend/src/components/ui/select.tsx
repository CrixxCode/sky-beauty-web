'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const EMPTY_VALUE = '__sky_beauty_empty__';

type NativeSelectProps = Omit<React.ComponentProps<'select'>, 'size'> & {
  /** Clases del menú desplegable (se abre en un portal, fuera del área de la página). */
  contentClassName?: string;
};

function optionValue(value: unknown, fallback: React.ReactNode) {
  if (value === undefined || value === null) return String(fallback ?? '');
  return String(value);
}

function toRadixValue(value: string | number | readonly string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? EMPTY_VALUE;
  const stringValue = value === undefined ? '' : String(value);
  return stringValue === '' ? EMPTY_VALUE : stringValue;
}

function fromRadixValue(value: string) {
  return value === EMPTY_VALUE ? '' : value;
}

function nativeChangeEvent(name: string | undefined, value: string) {
  return {
    target: { name, value },
    currentTarget: { name, value },
    type: 'change',
  } as unknown as React.ChangeEvent<HTMLSelectElement>;
}

const Select = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  (
    {
      children,
      className,
      value,
      defaultValue,
      disabled,
      name,
      id,
      onChange,
      onBlur,
      'aria-invalid': ariaInvalid,
      'aria-describedby': ariaDescribedBy,
      contentClassName,
      ...props
    },
    ref,
  ) => {
    const options = React.Children.toArray(children).filter(React.isValidElement);
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = React.useState(
      toRadixValue(defaultValue as string | number | readonly string[] | undefined),
    );
    const radixValue = isControlled
      ? toRadixValue(value as string | number | readonly string[] | undefined)
      : internalValue;
    const nativeValue = fromRadixValue(radixValue);

    function handleValueChange(nextRadixValue: string) {
      const nextNativeValue = fromRadixValue(nextRadixValue);
      if (!isControlled) setInternalValue(nextRadixValue);
      onChange?.(nativeChangeEvent(name, nextNativeValue));
    }

    return (
      <>
        <select
          ref={ref}
          name={name}
          value={nativeValue}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={() => undefined}
          {...props}
        >
          {children}
        </select>
        <SelectPrimitive.Root
          value={radixValue}
          disabled={disabled}
          onValueChange={handleValueChange}
          onOpenChange={(open) => {
            if (!open) onBlur?.({ type: 'blur' } as React.FocusEvent<HTMLSelectElement>);
          }}
        >
          <SelectPrimitive.Trigger
            id={id}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={cn(
              'flex min-h-11.25 w-full items-center justify-between gap-2 rounded-none border border-field-border bg-white px-3.5 py-3.25 text-left text-[11px] text-ink outline-offset-2 max-[600px]:text-base store:min-[601px]:text-xs transition-colors focus:border-field-focus disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger-border',
              className,
            )}
          >
            <SelectPrimitive.Value />
            <SelectPrimitive.Icon asChild>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#77636f]" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              position="popper"
              sideOffset={4}
              className={cn(
                'z-[160] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden border border-admin-line bg-white text-ink shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                contentClassName,
              )}
            >
              <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-[#77636f]">
                <ChevronUp className="h-3.5 w-3.5" />
              </SelectPrimitive.ScrollUpButton>
              <SelectPrimitive.Viewport className="p-1">
                {options.map((option, index) => {
                  const optionProps = option.props as React.ComponentProps<'option'>;
                  const rawValue = optionValue(optionProps.value, optionProps.children);
                  const itemValue = rawValue === '' ? EMPTY_VALUE : rawValue;
                  return (
                    <SelectPrimitive.Item
                      key={`${itemValue}-${index}`}
                      value={itemValue}
                      disabled={optionProps.disabled}
                      className="relative flex min-h-9 cursor-pointer select-none items-center px-8 py-2 text-[11px] text-[#493a45] outline-none hover:bg-[#faf1fa] focus:bg-[#faf1fa] data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                    >
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        <SelectPrimitive.ItemIndicator>
                          <Check className="h-3.5 w-3.5 text-[#764b77]" />
                        </SelectPrimitive.ItemIndicator>
                      </span>
                      <SelectPrimitive.ItemText>{optionProps.children}</SelectPrimitive.ItemText>
                    </SelectPrimitive.Item>
                  );
                })}
              </SelectPrimitive.Viewport>
              <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-[#77636f]">
                <ChevronDown className="h-3.5 w-3.5" />
              </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
      </>
    );
  },
);
Select.displayName = 'Select';

export { Select };
