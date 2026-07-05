import {Share} from 'react-native';
import {Platform} from 'react-native';

export async function shareLocalMediaFile(localPath: string, title: string): Promise<void> {
  const uri = localPath.startsWith('file://') ? localPath : `file://${localPath}`;
  if (Platform.OS === 'ios') {
    await Share.share({url: uri, title});
    return;
  }
  await Share.share({message: title, url: uri, title});
}
