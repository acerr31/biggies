// public/js/home.js

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("jwtToken");

    // If no token, redirect to login
    if (!token) {
        window.location.href = "/";
        return;
    }
});