import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface UnsavedChangesDialogProps {
  open: boolean
  onStay: () => void
  onLeave: () => void
}

export function UnsavedChangesDialog({ open, onStay, onLeave }: UnsavedChangesDialogProps) {
  return (
    <AlertDialog
      open={open}
      // onOpenChange fires when the dialog closes for any reason (Escape,
      // overlay click, Stay button, or after Leave triggers navigation).
      // The caller guards onStay with a blocker-status check so the call
      // is a no-op once proceed() has already been invoked.
      onOpenChange={(isOpen) => {
        if (!isOpen) onStay()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes that will be lost if you leave this page. Are you sure you want
            to continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay on page</AlertDialogCancel>
          <AlertDialogAction onClick={onLeave}>Leave page</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
