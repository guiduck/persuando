# Overview

## Product

`Persuando` is a real-time contextual assistant for meetings, simulated interviews, technical study, and coding practice.

The product uses a two-mode architecture:

1. **Capture Mode** runs on the machine where the conversation, class, study session, or coding exercise is happening.
2. **Response Mode** runs on another machine or browser session and shows live transcripts, summaries, insights, suggested responses, and explanations.

## Users

- Primary user: a professional who wants help following business meetings, organizing ideas, and preparing thoughtful responses.
- Secondary users: candidates practicing interviews, students, and developers practicing algorithm exercises.
- Admin/operator: the product owner or future workspace administrator responsible for account, provider, privacy, and session settings.

## Core Workflow

1. The user signs in to the Windows desktop Capture App.
2. The Capture App shows a small floating toolbar that can stay above other apps while the main window is closed.
3. The user explicitly enables capture options such as microphone transcription, permitted periodic screenshots, or code/practice context.
4. The Capture App sends authorized audio chunks and screen/context events to the backend in real time.
5. The Response Mode can open on the same machine, another browser, or another device to show transcripts, summaries, topic explanations, and suggested responses.
6. The user can hide or show the toolbar from the Windows tray, pause capture, revoke permissions, or end the session at any time without killing the background process.

## Current Focus

The current build focus is product foundation: document the scope, architecture, safety boundaries, user settings, consent model, and MVP path before creating Spec Kit artifacts or production code.
