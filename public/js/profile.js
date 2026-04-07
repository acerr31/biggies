// public/js/profile.js
function showShareToast(message) {
    let toast = document.getElementById("share-toast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "share-toast";
        toast.className = "share-toast";
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showShareToast.hideTimeout);
    showShareToast.hideTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 2200);
}

async function copyProfileInvite(username) {
    const inviteText = `Join me on Plated! @${username}`;

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(inviteText);
        } else {
            const tempInput = document.createElement("textarea");
            tempInput.value = inviteText;
            tempInput.setAttribute("readonly", "");
            tempInput.style.position = "absolute";
            tempInput.style.left = "-9999px";
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand("copy");
            document.body.removeChild(tempInput);
        }

        showShareToast(`Copied: ${inviteText}`);
    } catch (error) {
        console.error("Error copying invite text:", error);
        showShareToast("Could not copy profile message.");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    console.log("Profile page loaded");

    const token = localStorage.getItem("jwtToken");
    const shareBtn = document.getElementById("share-profile-btn");

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

        // phone format
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
        if (shareBtn) {
            shareBtn.addEventListener("click", async () => {
            const username = (document.getElementById("profile-username")?.textContent || "").trim();

        if (!username || username === "—") {
            showShareToast("Username unavailable to share.");
            return;
        }

        await copyProfileInvite(username);
    });
}

    } catch (error) {
        console.error("Error loading profile:", error);
        document.getElementById("message").textContent =
            "Server connection error.";
    }
});

const editBtn = document.getElementById("edit-profile-btn");
if (editBtn) {
  editBtn.addEventListener("click", () => {
    window.location.href = "/edit-profile";
  });
}