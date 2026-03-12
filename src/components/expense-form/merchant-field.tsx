import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { shouldShowCreateOption } from '@/lib/combobox'

interface MerchantFieldProps {
  field: {
    state: { value: string; meta: { errors: Array<{ message?: string } | undefined> } }
    handleChange: (value: string) => void
    handleBlur: () => void
  }
  isLoading: boolean
  merchants: string[]
}

export function MerchantField({ field, isLoading, merchants }: MerchantFieldProps) {
  const [isOpen, setIsOpen] = useState(false)

  const hasErrors = field.state.meta.errors.length > 0

  return (
    <Field data-invalid={hasErrors || undefined}>
      <FieldLabel htmlFor="merchant-combobox">Merchant</FieldLabel>
      <Popover
        open={isOpen && !isLoading}
        onOpenChange={(open) => {
          setIsOpen(open)
          if (!open) field.handleBlur()
        }}
      >
        <PopoverTrigger
          render={
            <Button
              id="merchant-combobox"
              type="button"
              variant="outline"
              role="combobox"
              aria-describedby={hasErrors ? 'merchant-error' : undefined}
              aria-invalid={hasErrors}
              className="w-full justify-start text-left font-normal"
              disabled={isLoading}
            />
          }
        >
          {field.state.value || 'Select or type...'}
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search or create..."
              value={field.state.value}
              onValueChange={(v) => field.handleChange(v)}
              disabled={isLoading}
            />
            <CommandList>
              <CommandEmpty>No merchants found</CommandEmpty>
              <CommandGroup heading="Recent merchants">
                {merchants.map((m) => (
                  <CommandItem
                    key={m}
                    value={m}
                    onSelect={() => {
                      field.handleChange(m)
                      setIsOpen(false)
                    }}
                  >
                    {m}
                  </CommandItem>
                ))}
              </CommandGroup>
              {shouldShowCreateOption(merchants, field.state.value) && (
                <>
                  <CommandSeparator />
                  <CommandGroup forceMount>
                    <CommandItem forceMount onSelect={() => setIsOpen(false)}>
                      + Use &quot;{field.state.value}&quot;
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <FieldError id="merchant-error" errors={field.state.meta.errors} />
    </Field>
  )
}
