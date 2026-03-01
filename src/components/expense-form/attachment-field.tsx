import { useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FieldLabel } from '@/components/ui/field'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { AttachmentPreview } from './attachment-preview'
import { ACCEPTED_FILE_TYPES } from './schema'

interface AttachmentFieldProps {
  attachmentId: Id<'_storage'> | undefined
  isLoading: boolean
  isUploading: boolean
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveAttachment: () => void
}

export function AttachmentField({
  attachmentId,
  isLoading,
  isUploading,
  onFileChange,
  onRemoveAttachment,
}: AttachmentFieldProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  return (
    <div className="space-y-2">
      <FieldLabel htmlFor="attachment-input">Attachment (optional)</FieldLabel>
      {attachmentId ? (
        <div className="space-y-3 rounded-md border p-3">
          <AttachmentPreview attachmentId={attachmentId} />
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={isLoading}
                />
              }
            >
              Remove attachment
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove attachment?</AlertDialogTitle>
                <AlertDialogDescription>
                  The attachment will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    onRemoveAttachment()
                    setShowDeleteDialog(false)
                  }}
                  className="bg-destructive text-destructive-foreground"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : (
        <Input
          id="attachment-input"
          type="file"
          accept={ACCEPTED_FILE_TYPES.join(',')}
          onChange={onFileChange}
          disabled={isUploading || isLoading}
        />
      )}
      {isUploading && <p className="text-muted-foreground text-sm">Uploading...</p>}
      <p className="text-muted-foreground text-xs">Images or PDF, maximum 10MB</p>
    </div>
  )
}
