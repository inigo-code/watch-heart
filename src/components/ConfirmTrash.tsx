import { ActionSheet } from '@/components/ActionSheet';
import { TRASH_DAYS } from '@/store/DiaryStore';

/** Asks before an entry goes to Trash: shown while `title` is set. */
export function ConfirmTrash({ title, onConfirm, onClose }: { title: string | null; onConfirm: () => void; onClose: () => void }) {
  return (
    <ActionSheet
      visible={title !== null}
      title={title !== null ? `Move “${title}” to Trash? It waits there for ${TRASH_DAYS} days, so you can bring it back.` : undefined}
      onClose={onClose}
      actions={[{ label: 'Move to Trash', icon: 'trash-outline', destructive: true, onPress: onConfirm }]}
    />
  );
}
