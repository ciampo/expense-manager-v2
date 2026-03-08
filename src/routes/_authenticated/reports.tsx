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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CSV_BOM, CSV_EOL, csvRow } from '@/lib/csv'
import { centsToInputValue, formatCurrency, getMonthName } from '@/lib/format'
import { extensionFromContentType, promiseAllSettledPooled } from '@/lib/download-utils'
import { toast } from 'sonner'
import { Suspense, useState } from 'react'
const loadFileSaver = () => import('file-saver').then((m) => m.saveAs)
const loadJSZip = () => import('jszip').then((m) => m.default)

export const Route = createFileRoute('/_authenticated/reports')({
  component: ReportsPage,
})

function ReportsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Generate monthly reports of your expenses</p>
      </div>

      <Suspense fallback={<ReportPageSkeleton />}>
        <ReportsContent />
      </Suspense>
    </div>
  )
}

function ReportsContent() {
  const { data: availableMonths } = useSuspenseQuery(convexQuery(api.reports.availableMonths, {}))

  const [selectedMonth, setSelectedMonth] = useState('')

  const effectiveMonth =
    selectedMonth ||
    (availableMonths.length > 0 ? `${availableMonths[0].year}-${availableMonths[0].month}` : '')

  if (availableMonths.length === 0) {
    return (
      <p className="text-muted-foreground">
        No expense data yet. Add some expenses to generate reports.
      </p>
    )
  }

  const [year, month] = effectiveMonth.split('-').map(Number)

  return (
    <>
      {/* Month selector */}
      <div className="mb-8">
        <label id="reports-month-label" className="mb-2 block text-sm font-medium">
          Select month
        </label>
        <Select value={effectiveMonth} onValueChange={(value) => value && setSelectedMonth(value)}>
          <SelectTrigger className="w-64" aria-labelledby="reports-month-label">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map((m) => (
              <SelectItem key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                {getMonthName(m.month, m.year)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Suspense fallback={<ReportSkeleton />}>
        <MonthlyReport year={year} month={month} />
      </Suspense>
    </>
  )
}

function ReportPageSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-2 h-4 w-24" />
        <Skeleton className="h-10 w-64" />
      </div>
      <ReportSkeleton />
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
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
  const { data } = useSuspenseQuery(convexQuery(api.reports.monthlyData, { year, month }))
  const { data: attachments } = useSuspenseQuery(
    convexQuery(api.reports.monthlyAttachments, { year, month }),
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

      let csv = csvRow(['Date', ...allCategories, 'Total']) + CSV_EOL

      const dates = Object.keys(grouped).sort()
      for (const date of dates) {
        const row = [date]
        let dayTotal = 0

        for (const category of allCategories) {
          const amount = grouped[date][category] || 0
          row.push(centsToInputValue(amount))
          dayTotal += amount
        }

        row.push(centsToInputValue(dayTotal))
        csv += csvRow(row) + CSV_EOL
      }

      const totalsRow = ['TOTAL']
      for (const category of allCategories) {
        const categoryTotal = data.categories[category]?.total || 0
        totalsRow.push(centsToInputValue(categoryTotal))
      }
      totalsRow.push(centsToInputValue(data.total))
      csv += csvRow(totalsRow) + CSV_EOL

      // Download
      const blob = new Blob([CSV_BOM + csv], { type: 'text/csv;charset=utf-8;' })
      const monthName = getMonthName(month, year).replace(' ', '-')
      const saveAs = await loadFileSaver()
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
      const [JSZip, saveAs] = await Promise.all([loadJSZip(), loadFileSaver()])
      const zip = new JSZip()

      toast.info('Downloading attachments...')

      const filenameCount: Record<string, number> = {}

      const withUrl = attachments.filter(
        (a): a is typeof a & { url: string } => typeof a.url === 'string' && a.url.length > 0,
      )

      const DOWNLOAD_TIMEOUT_MS = 30_000

      const downloadResults = await promiseAllSettledPooled(
        withUrl.map((attachment) => async () => {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)
          try {
            const response = await fetch(attachment.url, { signal: controller.signal })
            if (!response.ok) {
              throw new Error(
                `HTTP ${response.status} downloading attachment for ${attachment.date}-${attachment.merchant}`,
              )
            }
            const blob = await response.blob()
            return {
              attachment,
              blob,
              contentType: response.headers.get('content-type') || 'application/octet-stream',
            }
          } finally {
            clearTimeout(timeoutId)
          }
        }),
        5,
      )

      let successfulDownloads = 0
      let failedDownloads = 0

      for (const result of downloadResults) {
        if (result.status === 'rejected') {
          failedDownloads++
          console.error('Failed to download attachment:', result.reason)
          continue
        }

        const { attachment, blob, contentType } = result.value

        const extension = extensionFromContentType(contentType)
        const baseFilename = `${attachment.date}-${attachment.merchant.replace(/[^a-zA-Z0-9]+/g, '_')}`

        const countKey = baseFilename + extension
        const count = filenameCount[countKey] || 0
        filenameCount[countKey] = count + 1
        const filename =
          count > 0 ? `${baseFilename}-${count}${extension}` : `${baseFilename}${extension}`

        zip.file(filename, blob)
        successfulDownloads++
      }

      if (successfulDownloads === 0) {
        toast.error('Unable to download attachments')
        return
      }

      const content = await zip.generateAsync({ type: 'blob' })
      const monthName = getMonthName(month, year).replace(' ', '-')
      saveAs(content, `attachments-${monthName}.zip`)

      const fileLabel = successfulDownloads === 1 ? 'file' : 'files'
      if (failedDownloads > 0) {
        toast.warning(
          `ZIP downloaded (${successfulDownloads} ${fileLabel}, ${failedDownloads} failed)`,
        )
      } else {
        toast.success(`ZIP downloaded (${successfulDownloads} ${fileLabel})`)
      }
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
      <div className="grid gap-4 md:grid-cols-3">
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
                    <p className="text-muted-foreground text-sm">
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
            {isDownloadingCsv ? (
              'Generating...'
            ) : (
              <>
                <span aria-hidden="true">📄</span> Download CSV
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadZip}
            disabled={isDownloadingZip || !attachments?.length}
          >
            {isDownloadingZip ? (
              'Generating...'
            ) : (
              <>
                <span aria-hidden="true">📎</span> Download attachments (ZIP)
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
