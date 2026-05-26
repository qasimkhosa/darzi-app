import qrcode from 'qrcode-generator';
import { View } from 'react-native';

type ScannableQrCodeProps = {
  backgroundColor?: string;
  color?: string;
  quietZoneModules?: number;
  size?: number;
  value: string;
};

export function ScannableQrCode({
  backgroundColor = '#ffffff',
  color = '#0f172a',
  quietZoneModules = 4,
  size = 192,
  value,
}: ScannableQrCodeProps) {
  const qr = qrcode(0, 'M') as unknown as {
    addData: (data: string) => void;
    getModuleCount: () => number;
    isDark: (row: number, col: number) => boolean;
    make: () => void;
  };

  qr.addData(value);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const moduleSize = Math.max(3, Math.floor(size / (moduleCount + quietZoneModules * 2)));
  const quietZoneSize = moduleSize * quietZoneModules;
  const matrixSize = moduleSize * moduleCount;
  const totalSize = matrixSize + quietZoneSize * 2;

  return (
    <View
      style={{
        width: totalSize,
        height: totalSize,
        padding: quietZoneSize,
        backgroundColor,
      }}
      accessibilityRole="image"
      accessibilityLabel={`Scannable QR code for ${value}`}
    >
      {Array.from({ length: moduleCount }).map((_, rowIndex) => (
        <View key={`row-${rowIndex}`} style={{ flexDirection: 'row', height: moduleSize }}>
          {Array.from({ length: moduleCount }).map((__, colIndex) => (
            <View
              key={`cell-${rowIndex}-${colIndex}`}
              style={{
                width: moduleSize,
                height: moduleSize,
                backgroundColor: qr.isDark(rowIndex, colIndex) ? color : backgroundColor,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
