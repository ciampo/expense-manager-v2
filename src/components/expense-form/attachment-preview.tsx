import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Skeleton } from '@/components/ui/skeleton'

export function AttachmentPreview({ attachmentId }: { attachmentId: Id<'_storage'> }) {
  const { data: url, isLoading } = useQuery(
    convexQuery(api.storage.getUrl, { storageId: attachmentId }),
  )
  const [isImage, setIsImage] = useState(true)

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-md" />
  }

  if (!url) {
    return <p className="text-muted-foreground text-sm">Attachment not available</p>
  }

  return (
    <div className="space-y-2">
      {isImage ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt="Attachment preview"
            className="max-h-48 rounded-md border object-contain"
            onError={() => setIsImage(false)}
          />
        </a>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary inline-flex items-center gap-2 text-sm hover:underline"
        >
          <span aria-hidden="true">📄</span> View PDF attachment
        </a>
      )}
    </div>
  )
}
