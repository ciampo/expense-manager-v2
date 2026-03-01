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

interface Category {
  _id: string
  name: string
  icon?: string
  isPredefined?: boolean
}

interface CategoryFieldProps {
  categoryIdField: {
    state: {
      value: string | null
      meta: { errors: Array<{ message?: string } | undefined> }
    }
    handleChange: (value: string | null) => void
    handleBlur: () => void
  }
  newCatField: {
    state: { value: string; meta: { errors: Array<{ message?: string } | undefined> } }
    handleChange: (value: string) => void
    handleBlur: () => void
  }
  isLoading: boolean
  categories: Category[]
}

export function CategoryField({
  categoryIdField,
  newCatField,
  isLoading,
  categories,
}: CategoryFieldProps) {
  const [isOpen, setIsOpen] = useState(false)

  const hasErrors = categoryIdField.state.meta.errors.length > 0
  const selectedCategory = categories.find((c) => c._id === categoryIdField.state.value)
  const needsNewCategory = !categoryIdField.state.value && !!newCatField.state.value.trim()

  return (
    <Field data-invalid={hasErrors || undefined}>
      <FieldLabel htmlFor="category-combobox">Category</FieldLabel>
      <Popover
        open={isOpen && !isLoading}
        onOpenChange={(open) => {
          setIsOpen(open)
          if (!open) categoryIdField.handleBlur()
        }}
      >
        <PopoverTrigger
          render={
            <Button
              id="category-combobox"
              type="button"
              variant="outline"
              role="combobox"
              aria-describedby={hasErrors ? 'category-error' : undefined}
              aria-invalid={hasErrors}
              className="w-full justify-start text-left font-normal"
              disabled={isLoading}
            />
          }
        >
          {selectedCategory ? (
            <>
              {selectedCategory.icon && <span className="mr-2">{selectedCategory.icon}</span>}
              {selectedCategory.name}
            </>
          ) : needsNewCategory ? (
            newCatField.state.value.trim()
          ) : (
            'Select category...'
          )}
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search or create..."
              value={newCatField.state.value}
              onValueChange={(v) => newCatField.handleChange(v)}
              disabled={isLoading}
            />
            <CommandList>
              <CommandEmpty>No categories found</CommandEmpty>
              <CommandGroup heading="Categories">
                {categories.map((category) => (
                  <CommandItem
                    key={category._id}
                    value={category.name}
                    onSelect={() => {
                      categoryIdField.handleChange(category._id)
                      newCatField.handleChange('')
                      setIsOpen(false)
                    }}
                  >
                    {category.icon && <span className="mr-2">{category.icon}</span>}
                    {category.name}
                    {category.isPredefined && (
                      <span className="text-muted-foreground ml-auto text-xs">predefined</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              {shouldShowCreateOption(
                categories.map((c) => c.name),
                newCatField.state.value,
              ) && (
                <>
                  <CommandSeparator />
                  <CommandGroup forceMount>
                    <CommandItem
                      forceMount
                      onSelect={() => {
                        categoryIdField.handleChange(null)
                        setIsOpen(false)
                      }}
                    >
                      + Use &quot;{newCatField.state.value}&quot;
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <FieldError id="category-error" errors={categoryIdField.state.meta.errors} />
    </Field>
  )
}
