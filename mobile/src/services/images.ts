import * as ImagePicker from 'expo-image-picker';

export async function pickImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library access is required to upload an image.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const form = new FormData();
  form.append('image', {
    uri: asset.uri,
    name: asset.fileName ?? 'photo.jpg',
    type: asset.mimeType ?? 'image/jpeg',
  } as unknown as Blob);
  return form;
}
