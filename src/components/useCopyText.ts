import {useSnackbar} from '@/ui';

/** Copies text to the clipboard and says so in a snackbar; says so too when the clipboard refuses. */
export function useCopyText() {
  const snackbar = useSnackbar();
  return (text: string, copiedMessage: string, failedMessage: string) => {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (!clipboard) {
      snackbar.show({message: failedMessage});
      return;
    }
    clipboard
      .writeText(text)
      .then(() => snackbar.show({message: copiedMessage}))
      .catch(() => snackbar.show({message: failedMessage}));
  };
}
