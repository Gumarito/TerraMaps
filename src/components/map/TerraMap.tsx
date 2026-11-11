import { Platform } from 'react-native';
import { TerraMap as TerraMapWeb } from './TerraMap.web';
import { TerraMap as TerraMapNative } from './TerraMap.native';

export const TerraMap = Platform.OS === 'web' ? TerraMapWeb : TerraMapNative;
export default TerraMap;
