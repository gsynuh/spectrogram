import sharp from 'sharp';
import { existsSync } from 'fs';

export interface StitchOptions {
  basePath: string;
  numParts: number;
  outputPath: string;
  height: number;
}

export class ImageStitcher {
  public static async stitchParts(options: StitchOptions): Promise<void> {
    const { basePath, numParts, outputPath, height } = options;
    
    const partPaths: string[] = [];
    let totalWidth = 0;
    
    for (let i = 1; i <= numParts; i++) {
      const partPath = `${basePath}_part${i}.png`;
      
      if (!existsSync(partPath)) {
        console.error(`Part ${i} not found: ${partPath}`);
        throw new Error(`Part ${i} not found: ${partPath}`);
      }
      
      partPaths.push(partPath);
      
      const metadata = await sharp(partPath).metadata();
      if (metadata.width) {
        totalWidth += metadata.width;
      }
    }
    
    if (partPaths.length === 0) {
      throw new Error('No part images found to stitch');
    }
    
    try {
      const firstImage = await sharp(partPaths[0]).metadata();
      const imageHeight = firstImage.height || height;
      
      const compositeImage = sharp({
        create: {
          width: totalWidth,
          height: imageHeight,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      });
      
      const compositeOperations = [];
      let currentX = 0;
      
      for (const partPath of partPaths) {
        const metadata = await sharp(partPath).metadata();
        const partWidth = metadata.width || 0;
        
        compositeOperations.push({
          input: partPath,
          top: 0,
          left: currentX
        });
        
        currentX += partWidth;
      }
      
      await compositeImage
        .composite(compositeOperations)
        .png()
        .toFile(outputPath);
      
      console.log(`Stitched ${numParts} parts into: ${outputPath} (${totalWidth}x${height})`);
    } catch (error) {
      console.error('Error stitching images:', error);
      throw error;
    }
  }
  
  public static async getStitchInfo(basePath: string, numParts: number): Promise<{
    totalWidth: number;
    height: number;
    partSizes: Array<{ width: number; height: number }>;
  }> {
    const partSizes: Array<{ width: number; height: number }> = [];
    let totalWidth = 0;
    let height = 0;
    
    for (let i = 1; i <= numParts; i++) {
      const partPath = `${basePath}_part${i}.png`;
      
      if (!existsSync(partPath)) {
        throw new Error(`Part ${i} not found: ${partPath}`);
      }
      
      const metadata = await sharp(partPath).metadata();
      if (metadata.width && metadata.height) {
        partSizes.push({ width: metadata.width, height: metadata.height });
        totalWidth += metadata.width;
        height = metadata.height;
      }
    }
    
    return { totalWidth, height, partSizes };
  }
}