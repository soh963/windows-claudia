import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

interface Task {
    name: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

const TaskProgress: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>([]);

    useEffect(() => {
        const unlisten = listen<Task[]>('task_update', (event) => {
            setTasks(event.payload);
        });

        return () => {
            unlisten.then(f => f());
        };
    }, []);

    return (
        <div className="p-4 border-r border-gray-700">
            <h2 className="text-lg font-semibold mb-4">Task Progress</h2>
            <ul>
                {tasks.map((task, index) => (
                    <li key={index} className="mb-2">
                        <span className={`mr-2 ${task.status === 'completed' ? 'text-green-500' : task.status === 'failed' ? 'text-red-500' : 'text-yellow-500'}`}>
                            {task.status === 'completed' ? '✔' : task.status === 'failed' ? '✖' : '...'}
                        </span>
                        {task.name}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default TaskProgress;
