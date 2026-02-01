// 'use client';

// import React, { useEffect, useRef } from 'react';
// import { TranscriptSegment } from '@/lib/types';

// interface TranscriptFeedProps {
//     segments: TranscriptSegment[];
// }

// // Speaker styling configuration
// const SPEAKER_STYLES: Record<number, { align: string; border: string; bg: string; label: string }> = {
//     0: {
//         align: 'self-start text-left',
//         border: 'border-l-4 border-blue-500',
//         bg: 'bg-blue-500/10',
//         label: 'Speaker A',
//     },
//     1: {
//         align: 'self-end text-right',
//         border: 'border-r-4 border-red-500',
//         bg: 'bg-red-500/10',
//         label: 'Speaker B',
//     },
//     2: {
//         align: 'self-center text-center',
//         border: 'border-l-4 border-r-4 border-yellow-500',
//         bg: 'bg-yellow-500/10',
//         label: 'Speaker C',
//     },
// };

// const getDefaultStyle = (speakerId: number) => ({
//     align: 'self-start text-left',
//     border: 'border-l-4 border-purple-500',
//     bg: 'bg-purple-500/10',
//     label: `Speaker ${String.fromCharCode(65 + speakerId)}`,
// });

// export default function TranscriptFeed({ segments }: TranscriptFeedProps) {
//     const feedRef = useRef<HTMLDivElement>(null);

//     // Auto-scroll to bottom when new segments arrive
//     useEffect(() => {
//         if (feedRef.current) {
//             feedRef.current.scrollTop = feedRef.current.scrollHeight;
//         }
//     }, [segments]);

//     if (segments.length === 0) {
//         return (
//             <div className="flex flex-col items-center justify-center h-full text-gray-500 p-6">
//                 <div className="text-4xl mb-4 opacity-30">🎙️</div>
//                 <p className="text-sm text-center">
//                     Press the <span className="text-red-400 font-bold">RED BUTTON</span> to start
//                     <br />
//                     capturing the conversation.
//                 </p>
//             </div>
//         );
//     }

//     return (
//         <div
//             ref={feedRef}
//             className="flex flex-col gap-3 h-full overflow-y-auto p-4 scroll-smooth"
//         >
//             {segments.map((segment) => {
//                 const style = SPEAKER_STYLES[segment.speaker_id] || getDefaultStyle(segment.speaker_id);

//                 return (
//                     <div
//                         key={segment.id}
//                         className={`
//               flex flex-col max-w-[85%] px-4 py-2 rounded-lg
//               ${style.align} ${style.border} ${style.bg}
//               transition-all duration-300 ease-out
//               ${segment.is_final ? 'opacity-100' : 'opacity-70'}
//             `}
//                     >
//                         {/* Speaker label */}
//                         <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
//                             {style.label}
//                         </span>

//                         {/* Transcript text */}
//                         <p
//                             className={`
//                 text-sm leading-relaxed
//                 ${segment.is_final ? 'text-white font-medium' : 'text-gray-400 italic'}
//               `}
//                         >
//                             {segment.text}
//                             {!segment.is_final && (
//                                 <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse" />
//                             )}
//                         </p>

//                         {/* Timestamp */}
//                         <span className="text-[9px] text-gray-600 mt-1">
//                             {new Date(segment.timestamp).toLocaleTimeString()}
//                         </span>
//                     </div>
//                 );
//             })}
//         </div>
//     );
// }
