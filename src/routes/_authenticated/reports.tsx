import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, getMonthName } from '@/lib/format'
import { toast } from 'sonner'
import { Suspense, useState } from 'react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

export const Route = createFileRoute('/_authenticated/reports')({
  component: ReportsPage,
})

// Get available months (current and last 12 months)
function getAvailableMonths() {
  const months = []
  const now = new Date()

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      year: date.getFullYear(),
      month: date.getMonth() + 1, // 1-12
      label: getMonthName(date.getMonth() + 1, date.getFullYear()),
    })
  }

  return months
}

function ReportsPage() {
  const availableMonths = getAvailableMonths()
  const [selectedMonth, setSelectedMonth] = useState(
    `${availableMonths[0].year}-${availableMonths[0].month}`
  )

  const [year, month] = selectedMonth.split('-').map(Number)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Generate monthly reports of your expenses</p>
      </div>

      {/* Month selector */}
      <div className="mb-8">
        <label className="text-sm font-medium mb-2 block">Select month</label>
        <Select value={selectedMonth} onValueChange={(value) => value && setSelectedMonth(value)}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map((m) => (
              <SelectItem key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Suspense fallback={<ReportSkeleton />}>
        <MonthlyReport year={year} month={month} />
      </Suspense>
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

function MonthlyReport({ year, month }: { year: number; month: number }) {
  const { data } = useSuspenseQuery(
    convexQuery(api.reports.monthlyData, { year, month })
  )
  const { data: attachments } = useSuspenseQuery(
    convexQuery(api.reports.monthlyAttachments, { year, month })
  )

  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false)
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)

  const handleDownloadCsv = async () => {
    if (!data.expenses.length) {
      toast.error('No expenses to export')
      return
    }

    setIsDownloadingCsv(true)
    try {
      // Group expenses by date and category
      const grouped: Record<string, Record<string, number>> = {}

      for (const expense of data.expenses) {
        if (!grouped[expense.date]) {
          grouped[expense.date] = {}
        }
        if (!grouped[expense.date][expense.categoryName]) {
          grouped[expense.date][expense.categoryName] = 0
        }
        grouped[expense.date][expense.categoryName] += expense.amount
      }

      // Get all unique categories
      const allCategories = [...new Set(data.expenses.map((e) => e.categoryName))].sort()

      // Build CSV (using semicolon as delimiter for European locale compatibility)
      let csv = 'Date;' + allCategories.join(';') + ';Total\n'

      const dates = Object.keys(grouped).sort()
      for (const date of dates) {
        const row = [date]
        let dayTotal = 0

        for (const category of allCategories) {
          const amount = grouped[date][category] || 0
          row.push((amount / 100).toFixed(2).replace('.', ','))
          dayTotal += amount
        }

        row.push((dayTotal / 100).toFixed(2).replace('.', ','))
        csv += row.join(';') + '\n'
      }

      // Add totals row
      const totalsRow = ['TOTAL']
      for (const category of allCategories) {
        const categoryTotal = data.categories[category]?.total || 0
        totalsRow.push((categoryTotal / 100).toFixed(2).replace('.', ','))
      }
      totalsRow.push((data.total / 100).toFixed(2).replace('.', ','))
      csv += totalsRow.join(';') + '\n'

      // Download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const monthName = getMonthName(month, year).replace(' ', '-')
      saveAs(blob, `expenses-${monthName}.csv`)

      toast.success('CSV downloaded')
    } catch {
      toast.error('Error generating CSV')
    } finally {
      setIsDownloadingCsv(false)
    }
  }

  const handleDownloadZip = async () => {
    if (!attachments?.length) {
      toast.error('No attachments to download')
      return
    }

    setIsDownloadingZip(true)
    try {
      const zip = new JSZip()

      toast.info('Downloading attachments...')

      // Track successful downloads and handle filename collisions
      let successfulDownloads = 0
      const filenameCount: Record<string, number> = {}

      // Download each attachment and add to zip
      for (const attachment of attachments) {
        if (attachment.url) {
          try {
            const response = await fetch(attachment.url)
            const blob = await response.blob()

            // Get file extension from content type
            const contentType = response.headers.get('content-type') || 'application/octet-stream'
            let extension = '.bin'
            if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = '.jpg'
            else if (contentType.includes('png')) extension = '.png'
            else if (contentType.includes('gif')) extension = '.gif'
            else if (contentType.includes('webp')) extension = '.webp'
            else if (contentType.includes('pdf')) extension = '.pdf'

            // Create base filename: date-merchant
            const baseFilename = `${attachment.date}-${attachment.merchant.replace(/[^a-zA-Z0-9]/g, '_')}`

            // Handle filename collisions by adding index suffix
            const countKey = baseFilename + extension
            filenameCount[countKey] = (filenameCount[countKey] || 0) + 1
            const filename = filenameCount[countKey] > 1
              ? `${baseFilename}-${filenameCount[countKey]}${extension}`
              : `${baseFilename}${extension}`

            zip.file(filename, blob)
            successfulDownloads++
          } catch (error) {
            console.error('Failed to download attachment:', error)
          }
        }
      }

      // Only generate ZIP if at least one file was successfully added
      if (successfulDownloads === 0) {
        toast.error('Impossibile scaricare gli allegati')
        return
      }

      // Generate and download zip
      const content = await zip.generateAsync({ type: 'blob' })
      const monthName = getMonthName(month, year).replace(' ', '-')
      saveAs(content, `attachments-${monthName}.zip`)

      toast.success(`ZIP downloaded (${successfulDownloads} file)`)
    } catch {
      toast.error('Error generating ZIP')
    } finally {
      setIsDownloadingZip(false)
    }
  }

  const categoryList = Object.values(data.categories).sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(data.total)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Number of expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.expenses.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Attachments</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{attachments?.length || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Summary by category</CardTitle>
          <CardDescription>Expenses grouped by category</CardDescription>
        </CardHeader>
        <CardContent>
          {categoryList.length === 0 ? (
            <p className="text-muted-foreground">No expenses this month</p>
          ) : (
            <div className="space-y-3">
              {categoryList.map((category) => (
                <div key={category.name} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {category.count} {category.count === 1 ? 'expense' : 'expenses'}
                    </p>
                  </div>
                  <p className="font-bold">{formatCurrency(category.total)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export actions */}
      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>Download month data</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button
            onClick={handleDownloadCsv}
            disabled={isDownloadingCsv || data.expenses.length === 0}
          >
            {isDownloadingCsv ? 'Generating...' : '📄 Download CSV'}
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadZip}
            disabled={isDownloadingZip || !attachments?.length}
          >
            {isDownloadingZip ? 'Generating...' : '📎 Download attachments (ZIP)'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
