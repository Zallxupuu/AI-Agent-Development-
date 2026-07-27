# 🤖 WhatsApp AI Agent Dashboard

A complete, modern WhatsApp AI Agent built with Next.js, integrating directly with Supabase for real-time database management and Google's Gemini API for intelligent, context-aware automated replies. 

This project provides a sleek, admin-facing dashboard to manage client conversations, toggle the AI bot on or off per session, manage a product catalog, and monitor real-time AI sentiment analysis.

## ✨ Key Features

*   **Intelligent Auto-Reply (Gemini AI)**: Automatically responds to WhatsApp messages based on customizable system prompts and rules.
*   **Real-time Dashboard**: Modern UI with a glassmorphism design, dark/light mode toggle, and real-time updates for incoming chats.
*   **Zero-DB Sentiment & Language Detection**: The AI automatically analyzes customer emotions (😡/😊/😐) and detects their language (🇮🇩/🇬🇧/🇨🇳), appending visual indicators to the dashboard without requiring schema changes.
*   **Bot Toggle Switch**: Admins can seamlessly take over a conversation by disabling the AI for specific clients in real-time.
*   **Product Catalog Management**: Easily add, edit, and delete products that the AI uses as its knowledge base when answering customer queries.
*   **Dynamic AI Configuration**: Change store URL, QRIS payment links, and global prompt behaviors straight from the UI.
*   **Mobile Responsive**: A fully responsive sidebar and chat interface that feels like a native app on mobile devices.

## 🛠 Tech Stack

*   **Framework**: Next.js (App Router)
*   **Styling**: Tailwind CSS & Framer Motion
*   **Database & Auth**: Supabase
*   **AI Engine**: Google Gemini API
*   **Icons**: Lucide React

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have Node.js installed, along with a Supabase project and a Google Gemini API Key.

### 2. Environment Variables
Create a `.env.local` file in the root directory and add the following variables:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Installation
```bash
npm install
# or
yarn install
```

### 4. Run the Development Server
```bash
npm run dev
# or
yarn dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📦 Database Schema Requirements
This project expects the following tables in Supabase:
- `sessions`: Stores active WhatsApp sessions, bot status, and last active timestamps.
- `messages`: Stores chat history (client and AI).
- `products`: Stores the product catalog.
- `ai_config`: Stores global settings for the AI.

## 📝 License
This project is for educational and development purposes.

---
*Built with ❤️ for a smarter, automated customer service experience.*
