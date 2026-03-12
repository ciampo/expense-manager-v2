import { useState, type ChangeEvent, type RefObject } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FieldLabel, FieldTitle } from '@/components/ui/field'
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
import { ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE } from './schema'

interface AttachmentFieldProps {
  attachmentId: Id<'_storage'> | undefined
  isPersistedAttachment: boolean
  isLoading: boolean
  isUploading: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void
  onRemoveAttachment: () => void
}

export function AttachmentField({
  attachmentId,
  isPersistedAttachment,
  isLoading,
  isUploading,
  fileInputRef,
  onFileChange,
  onRemoveAttachment,
}: AttachmentFieldProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  return (
    <div className="space-y-2">
      {attachmentId ? (
        <FieldTitle>Attachment (optional)</FieldTitle>
      ) : (
        <FieldLabel htmlFor="attachment-input">Attachment (optional)</FieldLabel>
      )}
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
                  {isPersistedAttachment
                    ? 'The attachment will be permanently deleted.'
                    : 'The uploaded file will be removed from this expense.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setShowDeleteDialog(false)
                    onRemoveAttachment()
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
          ref={fileInputRef}
          id="attachment-input"
          type="file"
          accept={ALLOWED_CONTENT_TYPES.join(',')}
          onChange={onFileChange}
          disabled={isLoading}
        />
      )}
      {isUploading && <p className="text-muted-foreground text-sm">Uploading...</p>}
      <p className="text-muted-foreground text-xs">
        Images or PDF, maximum {Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB
      </p>
    </div>
  )
}
