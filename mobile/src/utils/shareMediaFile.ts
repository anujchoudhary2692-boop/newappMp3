import {Share, Platform} from 'react-native';

export async function shareLocalMediaFile(localPath: string, title: string): Promise<void> {
  const uri = localPath.startsWith('file://') ? localPath : `file://${localPath}`;
  if (Platform.OS === 'ios') {
    await Share.share({url: uri, title});
    return;
  }
  // Android Share.share({url}) is unreliable without FileProvider; include path in message.
  await Share.share({
    title,
    message: `${title}\n${uri}`,
  });
}
