# GeoSight AI

Build a frontend-only SIH Image Analysis Platform using React, TypeScript, Tailwind CSS, and Lucide React.

Design

UI inspired by ChatGPT desktop.

Strictly monochrome: white, off-white, light gray, dark gray, black.

No blue, green, purple, gradients, or colorful accents.

Minimal, clean, professional, spacious.

Subtle borders, rounded corners, light shadows.

Desktop-first responsive design.

Overall Layout

Use a 3-column layout:

Left Sidebar

Width: 260–280px.

+ New Chat button.

Search chats input.

Chat history list.

Active chat has subtle gray background.

Sidebar stays fixed while workspace scrolls.

Center Workspace

Main application area.

Top tabs:

Chatbot

Time-Series

Active tab uses dark text and a subtle bottom border.

Right Panel

Width: 280–320px.

Title: Image Library.

Shows all images added to the current chat/analysis.

Image grid with thumbnails.

Display image filename/date.

Clicking an image opens a larger preview.

Empty state: No images yet.

Chatbot Tab

Create a standard chatbot interface.

Chat Area

User and assistant messages.

Markdown-style responses.

Loading/typing state.

Empty state:

Image Analysis Assistant

Upload an image and ask a question about it.

Chat Input

Attachment button.

Text input.

Send button.

Multiple image upload support.

Image previews above the input.

Placeholder:

Ask a question about your images...

Right Image Library

Show every image uploaded in the current chat.

Time-Series Tab

Split the center workspace into two sections:

Upper Section — Time-Series Images

Header:

Time-Series Analysis

Description:

Add 2–4 images captured at different dates to analyze changes over time.

Button:

+ Add Image

Images must be displayed chronologically by date.

Each image card contains:

Image preview

Date

Filename

Remove button

Expand/preview button

Limit:

Minimum: 2 images

Maximum: 4 images

Show the current count, e.g. 3 / 4 images.

Add Image Dialog

Title:

Add Time-Series Image

Fields:

Image upload

Image date

Upload area:

Drag & drop image here

or Browse files

Supported formats:

PNG

JPG/JPEG

GeoTIFF

Buttons:

Cancel

Add Image

Validation:

File required.

Date required.

Maximum 4 images.

Time-series analysis requires at least 2 images.

Lower Section — Time-Series Chatbot

Header:

Analysis Assistant

Empty state:

Ask about changes across the selected images.

Example prompts:

What changed between the first and last image?

Identify areas of significant change.

Compare vegetation changes over time.

Input placeholder:

Ask about the time-series analysis...

Support normal chat messages, loading states, and markdown responses.

Right Image Library — Time-Series

The right panel must show all images added using + Add Image.

Display:

Image Library

3 / 4 images

Each item:

Thumbnail

Filename

Image date

The library must stay synchronized with the time-series images.

Removing an image from the time-series selection must also remove it from the Image Library.

Frontend Functionality

Implement with local React state only.

Include:

New Chat

Chat search

Chat history

Tab switching

Image upload

Multiple image upload

Image preview

Image removal

Add Time-Series Image dialog

Date selection

Chronological sorting

2–4 image validation

Chat message UI

Loading state

Empty states

Responsive layout

Use realistic mock data for chats, messages, images, filenames, and dates.

No backend, authentication, database, or API integration.

Suggested Components

AppLayout
Sidebar
ChatHistory
Chatbot
ChatMessages
ChatInput
TimeSeries
TimeSeriesImages
TimeSeriesImageCard
AddImageDialog
TimeSeriesChat
ImageLibrary
ImagePreview

Final Requirement

Make the interface feel like ChatGPT + professional geospatial image analysis: minimal, monochrome, clean, functional, and production-ready. Avoid unnecessary decorative elements.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2207416d-26b1-4a4f-aa84-3c2ab12572f6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
