import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.jsx"
import "./style.css"

/*
 * ENTRY POINT
 * index.html contains <div id="app"></div>.
 * createRoot connects React to that div, and render displays our App component.
 * StrictMode adds extra development checks; it does not add visible UI.
 */
ReactDOM.createRoot(document.getElementById("app")).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
