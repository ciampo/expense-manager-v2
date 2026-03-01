import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { formatCurrency, parseCurrencyToCents } from '@/lib/format'

interface AmountFieldProps {
  field: {
    state: { value: string; meta: { errors: Array<{ message?: string } | undefined> } }
    handleChange: (value: string) => void
    handleBlur: () => void
  }
  isLoading: boolean
}

export function AmountField({ field, isLoading }: AmountFieldProps) {
  const hasErrors = field.state.meta.errors.length > 0
  const parsedAmount = parseCurrencyToCents(field.state.value)

  return (
    <Field data-invalid={hasErrors || undefined}>
      <FieldLabel htmlFor="amount">Amount (EUR)</FieldLabel>
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <InputGroupText>€</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          id="amount"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          value={field.state.value}
          onChange={(e) => field.handleChange(e.target.value)}
          onBlur={field.handleBlur}
          disabled={isLoading}
          aria-describedby={hasErrors ? 'amount-error' : undefined}
          aria-invalid={hasErrors}
        />
      </InputGroup>
      {field.state.value && parsedAmount > 0 && (
        <p className="text-muted-foreground text-sm">{formatCurrency(parsedAmount)}</p>
      )}
      <FieldError id="amount-error" errors={field.state.meta.errors} />
    </Field>
  )
}
