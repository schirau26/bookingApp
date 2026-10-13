import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

export async function pickImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library access is required to upload an image.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const form = new FormData();
  form.append('image', new File(asset.uri));
  return form;
}
