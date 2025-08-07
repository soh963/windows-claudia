import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

interface SessionSummaryItem {
    type: 'action' | 'decision' | 'file_created' | 'note';
    content: string;
    timestamp: string;
}

const SessionSummary: React.FC = () => {
    const [summaryItems, setSummaryItems] = useState<SessionSummaryItem[]>([]);

    useEffect(() => {
        const unlisten = listen<SessionSummaryItem>('session_summary_update', (event) => {
            setSummaryItems((prevItems) => [...prevItems, event.payload]);
        });

        return () => {
            unlisten.then(f => f());
        };
    }, []);

    return (
        <div className="p-4 border-l border-gray-700">
            <h2 className="text-lg font-semibold mb-4">Session Summary</h2>
            <div className="space-y-2">
                {summaryItems.map((item, index) => (
                    <div key={index} className="text-sm text-gray-300">
                        <span className="font-bold">[{new Date(item.timestamp).toLocaleTimeString()}] </span>
                        <span className={`
                            ${item.type === 'action' ? 'text-blue-400' :
                              item.type === 'decision' ? 'text-green-400' :
                              item.type === 'file_created' ? 'text-purple-400' :
                              'text-gray-300'}
                        `}>
                            {item.type.toUpperCase()}: 
                        </span>
                        {item.content}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SessionSummary;
