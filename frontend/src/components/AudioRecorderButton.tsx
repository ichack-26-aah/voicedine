// 'use client';

// import React, { useState, useCallback } from 'react';
// import { Mic, Radio } from 'lucide-react';

// interface AudioRecorderButtonProps {
//     isRecording: boolean;
//     isConnecting: boolean;
//     volume: number; // 0-1 range
//     onToggle: () => void;
// }

// export default function AudioRecorderButton({
//     isRecording,
//     isConnecting,
//     volume,
//     onToggle,
// }: AudioRecorderButtonProps) {
//     // Calculate glow intensity based on volume (0-1)
//     const glowIntensity = Math.min(volume * 2, 1);
//     const glowSize = 20 + glowIntensity * 40;
//     const glowOpacity = 0.3 + glowIntensity * 0.5;

//     return (
//         <div className="relative flex flex-col items-center gap-3">
//             {/* Radar ripple effect when recording */}
//             {isRecording && (
//                 <>
//                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
//                         <div className="absolute w-32 h-32 rounded-full border-2 border-red-500/30 animate-radar-ripple" />
//                         <div className="absolute w-32 h-32 rounded-full border-2 border-red-500/30 animate-radar-ripple animation-delay-500" />
//                         <div className="absolute w-32 h-32 rounded-full border-2 border-red-500/30 animate-radar-ripple animation-delay-1000" />
//                     </div>
//                 </>
//             )}

//             {/* Main Button */}
//             <button
//                 onClick={onToggle}
//                 disabled={isConnecting}
//                 className={`
//           relative z-10 w-24 h-24 rounded-full
//           flex items-center justify-center
//           transition-all duration-300 ease-out
//           transform hover:scale-105 active:scale-95
//           ${isRecording
//                         ? 'bg-gradient-to-br from-red-600 to-red-800 shadow-red-glow'
//                         : 'bg-gradient-to-br from-red-500 to-red-700 animate-pulse-slow'
//                     }
//           ${isConnecting ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
//           border-4 border-red-400/30
//         `}
//                 style={{
//                     boxShadow: isRecording
//                         ? `0 0 ${glowSize}px ${glowSize / 2}px rgba(239, 68, 68, ${glowOpacity})`
//                         : '0 0 20px 5px rgba(239, 68, 68, 0.3)',
//                 }}
//             >
//                 {isConnecting ? (
//                     <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
//                 ) : isRecording ? (
//                     <Radio className="w-10 h-10 text-white animate-pulse" />
//                 ) : (
//                     <Mic className="w-10 h-10 text-white" />
//                 )}
//             </button>

//             {/* Status Text */}
//             <div className="text-center">
//                 <span
//                     className={`
//             text-xs font-bold tracking-widest uppercase
//             ${isRecording ? 'text-red-400' : 'text-gray-400'}
//           `}
//                 >
//                     {isConnecting
//                         ? 'CONNECTING...'
//                         : isRecording
//                             ? 'LISTENING [LIVE]'
//                             : 'INITIALIZE FEED'}
//                 </span>
//             </div>

//             {/* Volume indicator bar */}
//             {isRecording && (
//                 <div className="w-24 h-1 bg-gray-800 rounded-full overflow-hidden">
//                     <div
//                         className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-75"
//                         style={{ width: `${volume * 100}%` }}
//                     />
//                 </div>
//             )}
//         </div>
//     );
// }
