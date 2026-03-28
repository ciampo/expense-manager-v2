import { createFileRoute } from '@tanstack/react-router'
import { RouteErrorComponent } from '@/components/route-error'

export const Route = createFileRoute('/_authenticated/expenses/upload')({
  component: UploadPage,
  errorComponent: RouteErrorComponent,
  head: () => ({
    meta: [{ title: 'Upload Receipts — Expense Manager' }],
  }),
})

function UploadPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Upload Receipts</h1>
      <p className="text-muted-foreground mt-2">
        Bulk upload receipts to create draft expenses. Coming soon.
      </p>
    </div>
  )
}
