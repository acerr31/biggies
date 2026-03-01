// public/js/profile.js

document.addEventListener("DOMContentLoaded", async () => {
    console.log("Profile page loaded");

    const token = localStorage.getItem("jwtToken");

    // If no token, redirect to login
    if (!token) {
        console.log("No token found — redirecting to login");
        window.location.href = "/";
        return;
    }

    try {
        const response = await fetch("/api/profile", {
            method: "GET",
            headers: {
                // IMPORTANT: Send RAW token (NO Bearer)
                "Authorization": token,
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();
        console.log("Profile response:", data);

        if (!response.ok) {
            document.getElementById("message").textContent =
                data.message || "Failed to load profile.";
            return;
        }

        // Populate fields
        document.getElementById("profile-email").textContent =
            data.email || "—";

        document.getElementById("profile-username").textContent =
            data.username || "—";

        document.getElementById("profile-first-name").textContent =
            data.first_name || "—";

        document.getElementById("profile-last-name").textContent =
            data.last_name || "—";

        // Format phone nicely
        if (data.phone_number) {
            const digits = data.phone_number.replace(/\D/g, "");

            if (digits.length === 10) {
                document.getElementById("profile-phone").textContent =
                    `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
            } else {
                document.getElementById("profile-phone").textContent = digits;
            }
        } else {
            document.getElementById("profile-phone").textContent = "—";
        }

    } catch (error) {
        console.error("Error loading profile:", error);
        document.getElementById("message").textContent =
            "Server connection error.";
    }
});