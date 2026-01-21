import { useState, useEffect, useRef, useCallback } from 'react';
import * as fflate from 'fflate';

export interface ChapterInfo {
    title?: string;
    chapters?: { title: string; startPage: number }[];
    [key: string]: any;
}

export const useComicReader = (targetUrl: string | null) => {
  const [pages, setPages] = useState<string[]>([]); 
  const [zipFiles, setZipFiles] = useState<fflate.Unzipped>({}); 
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [currentBlobUrl, setCurrentBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [chapterInfo, setChapterInfo] = useState<ChapterInfo | null>(null);
  const [nextVolumeUrl, setNextVolumeUrl] = useState<string | null>(null);
  
  const blobCache = useRef<Map<string, string>>(new Map()); 

  // 加载并解压
  useEffect(() => {
    if (!targetUrl) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      setNextVolumeUrl(null);
      setChapterInfo(null);
      
      setPages([]);
      setZipFiles({});
      blobCache.current.forEach(url => URL.revokeObjectURL(url));
      blobCache.current.clear();

      try {
        const proxyUrl = `/proxy?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(proxyUrl);
        
        if (!res.ok) {
            if (res.status === 500) throw new Error('Proxy Error: 目标服务器不可达或拒绝访问');
            throw new Error(`Download failed: ${res.status}`);
        }
        
        const buffer = await res.arrayBuffer();
        const uint8 = new Uint8Array(buffer);

        const unzipped = await new Promise<fflate.Unzipped>((resolve, reject) => {
          fflate.unzip(uint8, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });

        // 过滤图片并自然排序
        const imageFiles = Object.keys(unzipped)
          .filter(name => name.match(/\.(jpg|jpeg|png|webp|avif|jxl)$/i) && !name.startsWith('__MACOSX'))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        if (imageFiles.length === 0) {
            throw new Error('此压缩包内没有找到支持的图片格式');
        }

        setZipFiles(unzipped);
        setPages(imageFiles);

        // 搜索 info.json
        const infoFiles = Object.keys(unzipped)
            .filter(name => name.toLowerCase().endsWith('info.json'))
            .sort((a, b) => a.length - b.length);

        if (infoFiles.length > 0) {
          const bestInfoFile = infoFiles[0];
          try {
            const text = new TextDecoder().decode(unzipped[bestInfoFile]);
            setChapterInfo(JSON.parse(text));
          } catch (e) { 
            console.warn("Info.json parse error", e); 
          }
        }

        // 恢复阅读进度
        const savedProgress = localStorage.getItem(`mezn-progress-${targetUrl}`);
        if (savedProgress) {
            const savedPage = parseInt(savedProgress, 10);
            if (!isNaN(savedPage) && savedPage >= 0 && savedPage < imageFiles.length) {
                setCurrentPage(savedPage);
            } else {
                setCurrentPage(0);
            }
        } else {
            setCurrentPage(0);
        }

        checkNextVolume(targetUrl);

      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    load();
    
    return () => {
       blobCache.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, [targetUrl]);

  // 检测下一卷逻辑
  const checkNextVolume = async (currentUrl: string) => {
      if (currentUrl.includes('?') || currentUrl.includes('token=') || currentUrl.includes('sign=')) {
          return;
      }

      try {
          const regex = /([_.-])(\d+)(\.[a-zA-Z0-9]+)$/;
          const match = currentUrl.match(regex);
          
          if (match) {
              const prefix = match[1];
              const numStr = match[2];
              const suffix = match[3];
              const nextNum = parseInt(numStr, 10) + 1;
              const nextNumStr = nextNum.toString().padStart(numStr.length, '0');
              
              const newUrl = currentUrl.replace(regex, `${prefix}${nextNumStr}${suffix}`);
              
              const proxyHeadUrl = `/proxy?url=${encodeURIComponent(newUrl)}`;
              const res = await fetch(proxyHeadUrl, { method: 'HEAD' });
              
              if (res.ok) {
                  console.log("Found next volume:", newUrl);
                  setNextVolumeUrl(newUrl);
              }
          }
      } catch (e) {
          console.log("Check next volume failed", e);
      }
  };

  // 生成 Blob URL & 预加载
  useEffect(() => {
    if (pages.length === 0) return;

    const getBlobUrl = (index: number) => {
      if (index < 0 || index >= pages.length) return null;
      const filename = pages[index];
      
      if (blobCache.current.has(filename)) {
        return blobCache.current.get(filename);
      }

      const fileData = zipFiles[filename];
      const ext = filename.split('.').pop()?.toLowerCase();
      const type = ext === 'jxl' ? 'image/jxl' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      
      const blob = new Blob([fileData as any], { type });
      const url = URL.createObjectURL(blob);
      blobCache.current.set(filename, url);
      return url;
    };

    const url = getBlobUrl(currentPage);
    if (url) setCurrentBlobUrl(url);

    const preloadCount = 5;
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        for (let i = 1; i <= preloadCount; i++) {
            getBlobUrl(currentPage + i);
        }
      });
    } else {
        setTimeout(() => {
            for (let i = 1; i <= preloadCount; i++) {
                getBlobUrl(currentPage + i);
            }
        }, 500);
    }

    if (targetUrl) {
        localStorage.setItem(`mezn-progress-${targetUrl}`, currentPage.toString());
    }

  }, [currentPage, pages, zipFiles, targetUrl]);

  const goNext = useCallback(() => setCurrentPage(p => Math.min(p + 1, pages.length - 1)), [pages.length]);
  const goPrev = useCallback(() => setCurrentPage(p => Math.max(p - 1, 0)), []);
  const jumpTo = useCallback((p: number) => setCurrentPage(Math.min(Math.max(0, p), pages.length - 1)), [pages.length]);

  return {
    loading,
    error,
    currentPage,
    total: pages.length,
    currentBlobUrl,
    goNext,
    goPrev,
    jumpTo,
    chapterInfo,
    nextVolumeUrl
  };
};
