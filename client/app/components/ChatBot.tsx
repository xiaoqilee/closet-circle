"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';

interface ChatMessage {
    id: string;
    content: string;
    timestamp: Date;
    isUser: boolean;
    image?: string;
}

export const ChatBot: React.FC = () => {
    const { user } = useUser();
    const [isOpen, setIsOpen] = useState(false);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [greeted, setGreeted] = useState(false);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Scroll only within the chat messages container, not the whole page
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    // Send a greeting to Rasa when the chat first opens
    useEffect(() => {
        if (!isOpen || greeted) return;

        const senderId = user?.email || `anon-${Date.now()}`;

        const sendGreet = async () => {
            try {
                const resp = await fetch('http://localhost:5005/webhooks/rest/webhook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sender: senderId,
                        message: '/greet',
                        metadata: { user_email: user?.email ?? null }
                    }),
                });

                const data = await resp.json();
                data.forEach((botMsg: { text?: string; image?: string }) => {
                    if (botMsg.text || botMsg.image) {
                        const botMessage: ChatMessage = {
                            id: Date.now().toString() + Math.random(),
                            content: botMsg.text || '',
                            timestamp: new Date(),
                            isUser: false,
                            image: botMsg.image,
                        };
                        setChatHistory((prev) => [...prev, botMessage]);
                    }
                });
                setGreeted(true);
            } catch (e) {
                console.warn('Greeting failed', e);
            }
        };

        sendGreet();
    }, [isOpen, greeted, user]);

    const submitMessage = async () => {
        if (!userInput.trim()) return;

        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            content: userInput,
            timestamp: new Date(),
            isUser: true,
        };

        setChatHistory((prev) => [...prev, newMessage]);
        const messageToSend = userInput;
        setUserInput('');
        setIsLoading(true);

        try {
            // Call Rasa webhook
            const response = await fetch('http://localhost:5005/webhooks/rest/webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender: user?.email || `anon-${Date.now()}`,
                    message: messageToSend,
                    metadata: { user_email: user?.email ?? null }
                }),
            });

            const data = await response.json();
            
            // Add bot responses to chat
            data.forEach((botMsg: { text?: string; image?: string }) => {
                if (botMsg.text || botMsg.image) {
                    const botMessage: ChatMessage = {
                        id: Date.now().toString() + Math.random(),
                        content: botMsg.text || '',
                        timestamp: new Date(),
                        isUser: false,
                        image: botMsg.image,
                    };
                    setChatHistory((prev) => [...prev, botMessage]);
                }
            });
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage: ChatMessage = {
                id: Date.now().toString(),
                content: "Sorry, I couldn't connect to the server. Please try again.",
                timestamp: new Date(),
                isUser: false,
            };
            setChatHistory((prev) => [...prev, errorMessage]);
        }

        setIsLoading(false);
        inputRef.current?.focus();
    };

    return (
        <>
            {/* Floating chat button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 w-20 h-20 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 ease-in-out flex items-center justify-center z-50 hover:scale-110"
                aria-label="Toggle chat"
            >
                <div className={`transition-transform duration-300 ${isOpen ? 'rotate-90 scale-110' : 'rotate-0 scale-100'}`}>
                    {isOpen ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    )}
                </div>
            </button>

            {/* Chat window */}
            <div 
                className={`fixed bottom-28 right-6 w-3xl h-[500px] bg-white rounded-lg shadow-xl flex flex-col z-40 border border-gray-200 origin-bottom-right transition-all duration-300 ease-out ${
                    isOpen 
                        ? 'scale-100 opacity-100 translate-y-0' 
                        : 'scale-95 opacity-0 translate-y-4 pointer-events-none'
                }`}
            >
                {/* Header */}
                <div className="bg-[#284472] text-white text-xl px-4 py-3 rounded-t-lg">
                    <h3 className="font-semibold">Clossie 👗</h3>
                    <p className="opacity-80">Your Closet Circle Assistant</p>
                </div>

                {/* Messages */}
                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3 text-xl">
                    {chatHistory.length === 0 && (
                        <p className="text-gray-400 text-center mt-4">
                            Hi! Ask me to find clothes for you 👋
                        </p>
                    )}
                    {chatHistory.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] px-3 py-2 rounded-lg text-xl ${
                                    msg.isUser
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-100 text-gray-800'
                                }`}
                            >
                                {msg.image && (
                                    <img 
                                        src={msg.image} 
                                        alt="Item" 
                                        className="rounded-lg mb-2 max-h-48 object-cover"
                                    />
                                )}
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg text-sm">
                                Typing...
                            </div>
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="p-3 border-t">
                    <div className="flex gap-2 text-xl">
                        <input
                            ref={inputRef}
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !isLoading) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    submitMessage();
                                    // Keep focus on input
                                    setTimeout(() => inputRef.current?.focus(), 0);
                                }
                            }}
                            placeholder="Type a message..."
                            disabled={isLoading}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-black bg-white"
                        />
                        <button
                            onClick={submitMessage}
                            disabled={isLoading || !userInput.trim()}
                            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};