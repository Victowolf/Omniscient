# Omniscient

Omniscient is a web app for asking questions about satellite and aerial images. You upload one or more images, type a question, and a vision model answers based on what it sees. It also has a Time Series mode where you add 2 to 4 images of the same place taken on different dates and ask what changed between them.

The project has two parts. The Backend is a Python FastAPI server that prepares images and talks to a vLLM model server. The Frontend is a React app with a chat workspace, an image library and a time series view.

## Index

1. [What is in this folder](#1-what-is-in-this-folder)
2. [File structure](#2-file-structure)
3. [How it works](#3-how-it-works)
4. [Requirements](#4-requirements)
5. [What is env and how to set it](#5-what-is-env-and-how-to-set-it)
6. [Commands to start the Backend](#6-commands-to-start-the-backend)
7. [Commands to start the Frontend](#7-commands-to-start-the-frontend)
8. [API reference](#8-api-reference)
9. [Backend files explained](#9-backend-files-explained)
10. [Frontend files explained](#10-frontend-files-explained)
11. [Image handling and limits](#11-image-handling-and-limits)
12. [Deployment notes](#12-deployment-notes)
13. [Common problems](#13-common-problems)


## 1. What is in this folder

The root folder is called Omniscient and holds two folders:

1. Backend: the FastAPI server, the prompts, the TIFF and GeoTIFF converter and the client that calls the model server.
2. Frontend: the user interface built with TanStack Start, React 19, TypeScript and Tailwind CSS 4.

The root README.md was empty, and this file replaces it.

## 2. File structure

```
Omniscient
    README.md
    Backend
        .gitignore
        __init__.py
        config.py
        main.py
        prompt_builder.py
        prompts.py
        raster_processor.py
        requirements.txt
        response_filter.py
        runtime.txt
        schemas.py
        vllm_client.py
    Frontend
        .env.example
        .gitignore
        .prettierignore
        .prettierrc
        AGENTS.md
        README.md
        bun.lock
        bunfig.toml
        components.json
        eslint.config.js
        package.json
        package-lock.json
        tsconfig.json
        vercel.json
        vite.config.ts
        public
            robots.txt
            assets
                login-background.mp4
                omniscient-logo.webp
        src
            router.tsx
            routeTree.gen.ts
            server.ts
            start.ts
            styles.css
            components
                image-analysis-platform.tsx
                ui
                    (shadcn UI parts such as button, dialog, sidebar, tabs and so on)
            hooks
                use-mobile.tsx
            lib
                error-capture.ts
                error-page.ts
                lovable-error-reporting.ts
                utils.ts
            routes
                README.md
                __root.tsx
                index.tsx
```

## 3. How it works

1. The user opens the Frontend and clicks the guest login button. No account or password is needed.
2. The user uploads PNG, JPG or TIFF images and types a question.
3. The Frontend sends the question, the chat history and the images to the Backend as form data.
4. The Backend checks the limits, converts any TIFF or GeoTIFF file into a normal PNG, and builds a text prompt from the question and recent history.
5. The Backend sends the prompt, a system prompt and the images to the model server set in VLLM_API_URL.
6. The model server replies with text. The Backend removes markdown marks from it and returns it to the Frontend.
7. The Frontend shows the answer in the chat.

There are two chat modes. The Chatbot tab uses the VQA endpoint with any number of images from 0 to 4. The Time Series tab uses the timeseries endpoint, which needs at least 2 images, and the images are sorted by date before they are sent.

## 4. Requirements

Backend:

1. Python 3.12 (runtime.txt lists 3.12.10)
2. pip
3. A running model server that matches the format described in section 8

Frontend:

1. Node.js and npm (Bun also works, since bun.lock and bunfig.toml are included)

## 5. What is env and how to set it

An env file is a plain text file named .env that stores settings which change between machines, such as a server address. The file is not committed to git, which keeps private values out of the repository. Both .gitignore files already list .env.

### Backend env

Create a file named .env inside the Backend folder. The Backend reads it on start, and you must start the server from inside the Backend folder so the file is found.

Only one value is required:

* VLLM_API_URL: the full address of your model server endpoint. The Backend sends every request here.

All other values are optional and have defaults:

* VLLM_TIMEOUT_SECONDS: how long to wait for the model server. Default 120.
* MAX_IMAGES_PER_REQUEST: most images in one request. Default 4.
* MAX_IMAGE_SIZE_MB: largest allowed size for one image. Default 15.
* MAX_HISTORY_TURNS_IN_PROMPT: how many past question and answer pairs go into the prompt. Default 12.
* GENERATION_MAX_OUTPUT_TOKENS: length limit for an answer. Default 512.
* GENERATION_TEMPERATURE: randomness of the answer. Default 0.4.
* GENERATION_TOP_P: Default 0.95.
* GENERATION_TOP_K: Default 64.
* GENERATION_DO_SAMPLE: Default true.
* RASTER_RGB_BANDS: three band numbers (counting from 1) to show as red, green and blue for multi band TIFF files, written as a JSON list such as [4,3,2]. Empty by default, which uses bands 1, 2 and 3.
* RASTER_STRETCH_LOW_PERCENTILE: Default 2.0. Darkest values below this percentile are clipped.
* RASTER_STRETCH_HIGH_PERCENTILE: Default 98.0. Brightest values above this percentile are clipped.
* ALLOWED_ORIGINS: websites allowed to call the Backend, written as a JSON list. Default is ["*"], which allows all.

Example Backend/.env:

```
VLLM_API_URL=http://localhost:8001/generate
VLLM_TIMEOUT_SECONDS=120
MAX_IMAGES_PER_REQUEST=4
MAX_IMAGE_SIZE_MB=15
ALLOWED_ORIGINS=["http://localhost:5173"]
```

The address above is only an example. Use the real address of your own model server.

### Frontend env

The Frontend has a file named .env.example with three names:

```
VITE_API_URL=
VITE_DEMO_MODE=false
VITE_DEMO_LOGIN_PASSWORD=
```

To use it, copy it to a file named .env inside the Frontend folder.

Important: in the code provided, none of these three values is read anywhere. The Backend address is written directly in Frontend/src/components/image-analysis-platform.tsx as a constant named API_BASE_URL, and it points to https://backend-omniscient.onrender.com. To run against your own Backend, change that constant to your own address, for example http://localhost:8000. The login screen is a guest button only, so the demo password value is also unused.

## 6. Commands to start the Backend

Run these from the root folder:

```
cd Backend
python -m venv venv
```

Activate the virtual environment.

On Windows:

```
venv\Scripts\activate
```

On macOS or Linux:

```
source venv/bin/activate
```

Install the packages and start the server:

```
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API now runs at http://localhost:8000. Check it by opening http://localhost:8000/api/health in a browser. It should return {"status": "ok"}. FastAPI also gives you a test page at http://localhost:8000/docs.

Remember to create Backend/.env with VLLM_API_URL before you start the server. The server will not start without it.

## 7. Commands to start the Frontend

Run these from the root folder:

```
cd Frontend
npm install
npm run dev
```

The dev server prints its address in the terminal. Open that address in your browser.

Other commands:

1. npm run build: makes a production build.
2. npm run start: previews the production build with Nitro.
3. npm run preview: previews the build with Vite.
4. npm run lint: checks the code with ESLint.
5. npm run format: formats the code with Prettier.
6. npm run build:dev: builds in development mode.

If you prefer Bun, run bun install and then bun run dev.

## 8. API reference

All endpoints are on the Backend.

### GET /api/health

Returns {"status": "ok"}. Use it to check that the server is running.

### POST /api/chat/vqa

General question answering over images. Send as multipart form data:

1. prompt (text, required): the question.
2. history (text, optional): a JSON list of objects such as [{"user": "...", "assistant": "..."}].
3. images (files, optional): up to 4 images.

### POST /api/chat/timeseries

Change detection across dates. It takes the same fields as the VQA endpoint, but images must contain at least 2 files, and the images should be sent oldest first.

### Response

Both chat endpoints return JSON:

```
{
  "model": "name of the model",
  "response": "the answer text",
  "input_tokens": 0,
  "output_tokens": 0,
  "images_used": 0
}
```

### Error codes

1. 422: empty prompt, bad history JSON, too many images, image too large, too few images for time series, or a TIFF file that cannot be read.
2. 502: the model server could not be reached, took too long, returned an error, or gave an empty answer.

### What the model server must accept

The Backend sends a multipart POST to VLLM_API_URL with these form fields: prompt, system_prompt, max_output_tokens, temperature, top_p, top_k, do_sample, and one or more images files. It expects JSON back that contains response, and optionally model, input_tokens and output_tokens. This is a custom wrapper format, so a plain OpenAI style vLLM server will not work without an adapter in front of it.

## 9. Backend files explained

1. main.py: creates the FastAPI app, sets up CORS, defines the three routes, checks limits, reads history and runs the chat flow.
2. config.py: reads the settings from the environment and the .env file using pydantic settings.
3. schemas.py: the data shapes for one history turn and for the chat response.
4. prompts.py: two system prompts. One is for general Earth observation questions. The other is for change detection across dates. Both tell the model to answer only from what is visible, to say when something cannot be told from the image, and to reply in plain text.
5. prompt_builder.py: joins recent history, a note about attached images, notes about converted rasters, and the current question into one text prompt.
6. vllm_client.py: sends the request to the model server with httpx and turns connection, timeout and server errors into clear messages.
7. response_filter.py: cleans the model output by removing role prefixes, code fences, bullets, headers, bold marks, extra blank lines and wrapping quotes.
8. raster_processor.py: opens TIFF and GeoTIFF files with rasterio and renders them as an 8 bit PNG. Each band is stretched between two percentiles so that 8 bit photos and 16 bit satellite data both look reasonable. One band becomes grayscale, three bands become RGB, and four or more bands use the first three unless RASTER_RGB_BANDS is set. If the file has a coordinate system, it is reported to the model as a note, but the image is not reprojected.
9. requirements.txt: pinned Python packages (fastapi, uvicorn, python-multipart, httpx, pydantic, pydantic-settings, python-dotenv, rasterio, numpy, Pillow).
10. runtime.txt: the Python version for hosting platforms.
11. .gitignore: keeps .env, virtual environments, caches and logs out of git.
12. __init__.py: empty file that marks the folder as a package.

## 10. Frontend files explained

1. src/components/image-analysis-platform.tsx: the main screen. It holds the login page, left sidebar with chat history and search, the Chatbot tab, the Time Series tab, the Add Image dialog, the Image Library panel, the image preview and the mobile drawer. It also holds the code that calls the Backend.
2. src/components/ui: ready made interface parts from shadcn UI, such as button, dialog, tabs, sidebar, input, tooltip, accordion, chart and many more.
3. src/hooks/use-mobile.tsx: tells the layout when the screen is small.
4. src/lib/utils.ts: a helper for joining class names.
5. src/lib/error-capture.ts, error-page.ts and lovable-error-reporting.ts: catch errors and show a fallback error page.
6. src/routes/__root.tsx: the shared page shell, plus the 404 page and the error page.
7. src/routes/index.tsx: the home route, which sets the page title and description and shows the main screen.
8. src/router.tsx: creates the router and the query client.
9. src/routeTree.gen.ts: generated route list. Do not edit it by hand.
10. src/server.ts and src/start.ts: server entry and middleware for error pages and request protection.
11. src/styles.css: Tailwind setup, color variables and the login screen styles.
12. public/assets: the logo and the looping background video for the login page.
13. package.json, package-lock.json, bun.lock, bunfig.toml: package list and lock files.
14. vite.config.ts: build setup. It picks the Vercel target when deployed on Vercel and a Node server target otherwise.
15. vercel.json: install and build commands for Vercel.
16. components.json: shadcn UI settings.
17. eslint.config.js, .prettierrc, .prettierignore: code style rules.
18. tsconfig.json: TypeScript settings, with the @ shortcut pointing to src.
19. README.md and AGENTS.md: the original README is the design brief used to generate the interface, and AGENTS.md has a note about the Lovable editor and git history.

## 11. Image handling and limits

1. Accepted file types in the interface: PNG, JPG and JPEG, TIFF and GeoTIFF.
2. Most images per request: 4.
3. Largest single image: 15 MB.
4. Time series needs 2 to 4 images, each with a date.
5. History sent with a question: the last 12 turns.
6. Answer length: up to 512 tokens by default.
7. Chats and images live in the browser memory only. There is no database, so a page refresh clears them.

## 12. Deployment notes

1. Backend: runtime.txt suggests a platform such as Render. Set VLLM_API_URL in the platform settings and use this start command: uvicorn main:app --host 0.0.0.0 --port $PORT
2. Frontend: vercel.json is ready for Vercel, which runs npm ci and npm run build.
3. Before going live, change ALLOWED_ORIGINS from ["*"] to your Frontend address only.
4. Before going live, update API_BASE_URL in the Frontend code to your own Backend address.

## 13. Common problems

1. Backend fails on start with a missing field error: VLLM_API_URL is not set. Create Backend/.env.
2. Import errors such as no module named config: you started uvicorn from the wrong folder. Run it from inside Backend.
3. Error 502 saying the model server cannot be reached: the address in VLLM_API_URL is wrong or the model server is off.
4. Error 502 about a timeout: raise VLLM_TIMEOUT_SECONDS, or use smaller images.
5. Error 422 about image size or count: stay within 4 images and 15 MB each.
6. Frontend still calls the old hosted Backend: change API_BASE_URL in image-analysis-platform.tsx.
7. Browser blocks requests with a CORS message: add your Frontend address to ALLOWED_ORIGINS.
8. rasterio fails to install: use Python 3.12 and a recent pip so a prebuilt wheel is used.
