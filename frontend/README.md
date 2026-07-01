# Ready Set STEM - Frontend

This directory contains the React frontend for the Ready Set STEM application.

## Overview

The frontend is built using React and Vite and communicates with the Django backend through REST APIs.

## Technology Stack

- React
- Vite
- React Router
- Axios
- ESLint

## Prerequisites

Before running the frontend, ensure you have:

- Node.js (Latest LTS recommended)
- npm
- Git

## Installation

Install the project dependencies:

```bash
npm install
```

## Environment Variables

Create a `.env` file in the frontend directory using `.env.example` as a reference.

Example:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

## Run the Development Server

```bash
npm run dev
```

The application will be available at:

```
http://localhost:5173
```

## Project Structure

```
src/
├── assets/
├── components/
│   ├── common/
│   ├── layout/
│   └── ui/
├── hooks/
├── layouts/
├── pages/
│   ├── Login/
│   ├── Home/
│   ├── Tours/
│   ├── Pipeline/
│   ├── Analytics/
│   └── Admin/
├── services/
│   ├── api/
│   └── auth/
├── styles/
├── utils/
├── App.jsx
└── main.jsx
```

## Development Workflow

1. Update your local `develop` branch.
2. Create a feature branch for your task.
3. Implement and test your changes locally.
4. Create a Pull Request targeting `develop`.
5. Request at least one team member to review your Pull Request before merging.

## Notes

- Do not commit `.env` or other sensitive configuration files.
- All backend communication should be implemented through the shared API service located in `src/services/api`.
- Follow the project's Git workflow and coding standards.

---

**Project:** Ready Set STEM
**Organization:** APS Data Technologies
