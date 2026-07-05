declare module 'react-native-document-picker' {
  export type DocumentPickerResponse = {
    uri: string;
    name: string | null;
    fileCopyUri?: string | null;
    type?: string | null;
    size?: number | null;
  };

  const DocumentPicker: {
    pick: (opts: {
      allowMultiSelection?: boolean;
      type?: string[];
      copyTo?: 'documentDirectory' | 'cachesDirectory';
    }) => Promise<DocumentPickerResponse[]>;
    isCancel: (err: unknown) => boolean;
    types: {
      audio: string;
      video: string;
    };
  };

  export default DocumentPicker;
}
