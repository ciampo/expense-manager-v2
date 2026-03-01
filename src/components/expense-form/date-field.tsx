import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { parseLocalDate, toISODateString } from '@/lib/format'
import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'

interface DateFieldProps {
  field: {
    state: { value: string; meta: { errors: Array<{ message?: string } | undefined> } }
    handleChange: (value: string) => void
    handleBlur: () => void
  }
  isLoading: boolean
}

export function DateField({ field, isLoading }: DateFieldProps) {
  const [isOpen, setIsOpen] = useState(false)

  const selectedDate = field.state.value ? parseLocalDate(field.state.value) : undefined
  const hasErrors = field.state.meta.errors.length > 0

  return (
    <Field data-invalid={hasErrors || undefined}>
      <FieldLabel htmlFor="date-picker">Date</FieldLabel>
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
              id="date-picker"
              type="button"
              variant="outline"
              className="w-full justify-start text-left font-normal"
              disabled={isLoading}
              aria-invalid={hasErrors}
              aria-describedby={hasErrors ? 'date-error' : undefined}
            />
          }
        >
          {selectedDate ? format(selectedDate, 'PPP', { locale: enUS }) : 'Select date'}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => {
              if (d) {
                field.handleChange(toISODateString(d))
                setIsOpen(false)
              }
            }}
            locale={enUS}
          />
        </PopoverContent>
      </Popover>
      <FieldError id="date-error" errors={field.state.meta.errors} />
    </Field>
  )
}
