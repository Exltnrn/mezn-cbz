import { useEffect, useState, useRef } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { useSwipeable } from 'react-swipeable';
import { useComicReader } from './hooks/useComicReader';
import clsx from 'clsx';

type Direction = 'ltr' | 'rtl';

function App() {
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url');
    if (url) setTargetUrl(url);
  }, []);

  const { 
    loading, error, currentPage, total, currentBlobUrl, 
    goNext, goPrev, jumpTo, chapterInfo, nextVolumeUrl
  } = useComicReader(targetUrl);

  const [showControls, setShowControls] = useState(false);
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [inputPage, setInputPage] = useState<string>('');
  const [direction, setDirection] = useState<Direction>('rtl'); 
  
  const transformComponentRef = useRef<ReactZoomPanPinchRef | null>(null);
  const scaleRef = useRef<number>(1);

  // 翻页重置缩放
  useEffect(() => {
    if (transformComponentRef.current) {
        const { resetTransform } = transformComponentRef.current;
        resetTransform();
        scaleRef.current = 1;
    }
    setInputPage((currentPage + 1).toString());
  }, [currentPage]);

  // --- 导航逻辑 ---
  const handleNavNext = () => {
      if (currentPage === total - 1 && nextVolumeUrl) {
          if (confirm('本卷结束，是否跳转到下一卷？')) {
             window.location.href = `/?url=${encodeURIComponent(nextVolumeUrl)}`;
          }
          return;
      }
      goNext();
  };

  const onLeftAction = () => {
    if (direction === 'ltr') goPrev(); 
    else handleNavNext();              
  };

  const onRightAction = () => {
    if (direction === 'ltr') handleNavNext(); 
    else goPrev();                            
  };

  // --- 手势处理 ---
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
        if (scaleRef.current > 1.1) return;
        onRightAction(); 
    },
    onSwipedRight: () => {
        if (scaleRef.current > 1.1) return;
        onLeftAction();
    },
    preventScrollOnSwipe: true,
    trackMouse: false
  });

  // --- 键盘快捷键 ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      switch(e.key) {
        case 'ArrowRight': 
        case ' ': 
        case 'Enter':
          handleNavNext(); break;
        case 'ArrowLeft': 
          goPrev(); break;
        case 'f':
        case 'F':
          toggleFullscreen(); break;
        case 'm': 
          setShowControls(prev => !prev); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, nextVolumeUrl, total, currentPage]); 

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
  };

  const handleChapterClick = (pageIndex: number) => {
      jumpTo(pageIndex);
      setShowChapterModal(false);
      setShowControls(false);     
  };

  if (!targetUrl) return (
    <div className="flex flex-col items-center justify-center h-screen bg-viewer text-gray-300 p-4 text-center">
        <h1 className="text-2xl font-bold mb-4">Mezn CBZ Reader</h1>
        <p>请在 URL 后添加参数来打开漫画</p>
    </div>
  );

  if (loading) return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
          <div className="animate-pulse">Loading Comic...</div>
      </div>
  );
  
  if (error) return (
      <div className="flex items-center justify-center h-screen bg-black text-red-500 p-8 text-center">
          <div>
              <h2 className="text-xl font-bold mb-2">加载失败</h2>
              <p>{error}</p>
          </div>
      </div>
  );

  return (
    <div 
        className="h-screen w-screen bg-black relative overflow-hidden select-none"
        {...swipeHandlers}
    >
      <TransformWrapper
        ref={transformComponentRef}
        initialScale={1}
        minScale={1}
        maxScale={4}
        centerOnInit={true}
        wheel={{ step: 0.1 }}
        onTransformed={(e) => {
            scaleRef.current = e.state.scale;
        }}
      >
        <TransformComponent 
            wrapperClass="!w-full !h-full" 
            contentClass="!w-full !h-full flex items-center justify-center"
        >
          {currentBlobUrl && (
            <img 
              src={currentBlobUrl} 
              alt={`Page ${currentPage + 1}`} 
              className="max-w-full max-h-full object-contain" 
            />
          )}
        </TransformComponent>
      </TransformWrapper>

      {/* 点击交互层 */}
      <div className="absolute inset-0 flex z-10 pointer-events-none">
        <div 
          className="w-[30%] h-full cursor-pointer pointer-events-auto hover:bg-white/5 transition-colors duration-200"
          onClick={onLeftAction}
          title={direction === 'rtl' ? "下一页" : "上一页"}
        />
        <div 
          className="w-[40%] h-full cursor-pointer pointer-events-auto"
          onClick={() => setShowControls(!showControls)}
          title="菜单"
        />
        <div 
          className="w-[30%] h-full cursor-pointer pointer-events-auto hover:bg-white/5 transition-colors duration-200"
          onClick={onRightAction}
          title={direction === 'rtl' ? "上一页" : "下一页"}
        />
      </div>

      {/* 底部控制栏 */}
      <div 
        className={clsx(
          "absolute bottom-0 left-0 right-0 bg-gray-900/95 text-white transition-transform duration-300 z-20 flex flex-col backdrop-blur-sm border-t border-gray-700 safe-area-bottom",
          showControls ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="p-4 pb-4 flex flex-col gap-3">
            {/* 进度条 */}
            <input 
                type="range" 
                min="0" 
                max={total - 1} 
                value={currentPage} 
                onChange={(e) => jumpTo(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
            />
            
            {/* 按钮行 */}
            <div className="flex justify-between items-center text-sm flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <input 
                        type="number" 
                        value={inputPage}
                        onChange={(e) => setInputPage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const val = parseInt(inputPage) - 1;
                                if (!isNaN(val)) jumpTo(val);
                            }
                        }}
                        onFocus={(e) => e.target.select()}
                        className="w-12 bg-gray-800 text-white text-center rounded border border-gray-600 focus:outline-none focus:border-blue-500 py-1"
                    />
                    <span className="text-gray-400 whitespace-nowrap">/ {total}</span>
                </div>

                <div className="flex gap-2 items-center">
                    {chapterInfo?.chapters && chapterInfo.chapters.length > 0 && (
                        <button
                            onClick={() => setShowChapterModal(true)}
                            className="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 border border-gray-600 text-xs whitespace-nowrap"
                        >
                            目录
                        </button>
                    )}

                    <button 
                        onClick={() => setDirection(d => d === 'ltr' ? 'rtl' : 'ltr')}
                        className="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 border border-gray-600 text-xs whitespace-nowrap"
                    >
                        {direction === 'rtl' ? '日漫' : '普通'}
                    </button>

                    <button 
                        onClick={toggleFullscreen}
                        className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-500 text-white text-xs font-bold whitespace-nowrap"
                    >
                        全屏
                    </button>

                    {nextVolumeUrl && (
                        <a 
                            href={`/?url=${encodeURIComponent(nextVolumeUrl)}`}
                            className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-xs font-bold text-white whitespace-nowrap"
                        >
                            下一卷
                        </a>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* 章节目录弹窗 */}
      {showChapterModal && chapterInfo && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={() => setShowChapterModal(false)}
          >
              <div 
                className="bg-gray-900 text-white rounded-lg w-full max-w-sm max-h-[70vh] flex flex-col border border-gray-700 shadow-2xl"
                onClick={e => e.stopPropagation()} 
              >
                  <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800 rounded-t-lg">
                      <h3 className="font-bold truncate text-sm">{chapterInfo.title || '章节选择'}</h3>
                      <button onClick={() => setShowChapterModal(false)} className="text-gray-400 hover:text-white px-2 text-lg">×</button>
                  </div>
                  <div className="overflow-y-auto p-2 flex-1">
                      {chapterInfo.chapters?.map((chap, idx) => (
                          <button
                              key={idx}
                              onClick={() => handleChapterClick(chap.startPage - 1)}
                              className="w-full text-left p-3 hover:bg-gray-800 rounded border-b border-gray-800 last:border-0 flex justify-between items-center transition-colors"
                          >
                              <span className="text-sm font-medium">{chap.title}</span>
                              <span className="text-gray-500 text-xs bg-gray-800 px-2 py-0.5 rounded border border-gray-700">P{chap.startPage}</span>
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}
      
      {/* 顶部页码指示器 */}
      <div 
        className={clsx(
            "absolute bottom-4 right-4 text-white/50 text-xs select-none pointer-events-none z-0 px-2 py-1 bg-black/20 rounded transition-opacity duration-300",
            showControls ? "opacity-0" : "opacity-100"
        )}
      >
          {currentPage + 1} / {total}
      </div>
    </div>
  );
}

export default App;
