import { ksuExec, toast, setupSearch, setupScrollEvent, checkMMRL, applyRippleEffect } from "./util.js";

// Global variables
let whiteoutPaths = [];
let isShellRunning = false;
let pathToRemove = null;

// Fetch raw whiteout paths from the file
async function fetchWhiteoutPaths() {
    try {
        const result = await ksuExec('cat /data/adb/system_app_nuker/raw_whiteouts.txt 2>/dev/null || echo ""');
        // Filter out comments and empty lines
        const paths = result.stdout.split('\n')
            .filter(path => path.trim() && !path.trim().startsWith('#'));
        
        whiteoutPaths = paths;
        displayWhiteoutPaths(paths);
        return paths;
    } catch (error) {
        console.error("Failed to fetch whiteout paths:", error);
        toast("Failed to load whiteout paths");
        return [];
    }
}

// Display the whiteout paths in the UI
function displayWhiteoutPaths(paths) {
    const pathListDiv = document.getElementById("path-list");
    pathListDiv.innerHTML = "";

    // Display a message if no paths are available
    if (!paths || paths.length === 0) {
        pathListDiv.innerHTML = `
            <div class="empty-list-message">
                No raw whiteout paths added yet
            </div>
        `;
        return;
    }

    // Create HTML for each path
    paths.forEach(path => {
        const pathDiv = document.createElement("div");
        pathDiv.className = "path-item ripple-element";
        pathDiv.dataset.path = path;

        pathDiv.innerHTML = `
            <div class="path-info">
                <div class="path-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
                        <path d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"/>
                    </svg>
                </div>
                <span class="path-text">${path}</span>
            </div>
            <div class="path-actions">
                <button class="delete-path-btn ripple-element" aria-label="Delete path">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
                        <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/>
                    </svg>
                </button>
            </div>
        `;

        pathListDiv.appendChild(pathDiv);
    });

    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-path-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const pathItem = e.target.closest('.path-item');
            const path = pathItem.dataset.path;
            showRemoveConfirmation(path);
        });
    });

    applyRippleEffect();
}

// Save paths to the raw_whiteouts.txt file
async function saveWhiteoutPaths() {
    if (isShellRunning) return;
    
    isShellRunning = true;
    try {
        // Comments
        const header = `# Raw whiteout paths - one per line
# Lines starting with # are comments
# Format: /system/path/to/file/or/directory`;
        
        const content = `${header}\n${whiteoutPaths.join('\n')}`;
        await ksuExec(`echo '${content}' > /data/adb/system_app_nuker/raw_whiteouts.txt`);

        // Nuuuuuke!
        await ksuExec(`
            PATH=/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH
            busybox nsenter -t1 -m /data/adb/modules/system_app_nuker/nuke.sh
        `);
        
        toast("Changes applied. Reboot to take effect");
    } catch (error) {
        console.error("Failed to save whiteout paths:", error);
        toast("Failed to save changes");
    } finally {
        isShellRunning = false;
    }
}

// Add a new whiteout path
async function addWhiteoutPath(path) {
    if (!path || path.trim() === "") {
        toast("Please enter a valid path");
        return false;
    }

    // Format the path to ensure it starts with /system
    if (!path.startsWith("/system")) {
        path = "/system" + (path.startsWith("/") ? path : "/" + path);
    }

    // Check if path already exists
    if (whiteoutPaths.includes(path)) {
        toast("Path already exists");
        return false;
    }

    try {
        // Add to paths array
        whiteoutPaths.push(path);
        // Save to file
        await saveWhiteoutPaths();
        // Refresh display
        displayWhiteoutPaths(whiteoutPaths);
        toast("Path added successfully");
        return true;
    } catch (error) {
        console.error("Failed to add whiteout path:", error);
        toast("Failed to add path");
        return false;
    }
}

// Remove a whiteout path
async function removeWhiteoutPath(path) {
    try {
        // Remove from paths array
        whiteoutPaths = whiteoutPaths.filter(p => p !== path);
        // Save to file
        await saveWhiteoutPaths();
        // Refresh display
        displayWhiteoutPaths(whiteoutPaths);
        toast("Path removed successfully");
        return true;
    } catch (error) {
        console.error("Failed to remove whiteout path:", error);
        toast("Failed to remove path");
        return false;
    }
}

// Show the add path modal
function showAddPathModal() {
    const modal = document.getElementById('add-path-modal');
    const modalContent = modal.querySelector('.modal-content');
    const pathInput = document.getElementById('path-input');
    
    if (!modal) {
        console.error("Add path modal not found");
        return;
    }

    // Reset input
    pathInput.value = '';
    // Show modal with animation
    modal.style.display = 'flex';
    document.body.classList.add('no-scroll');
    // Force reflow to ensure transition works
    void modal.offsetWidth;
    
    modal.style.opacity = '1';
    modalContent.style.transform = 'scale(1)';
    
    // Add keyboard-friendly behavior
    pathInput.addEventListener('focus', () => {
        // Move modal up when keyboard appears
        modalContent.style.transform = 'translateY(-20vh)';
    });
    
    pathInput.addEventListener('blur', () => {
        // Reset position when keyboard disappears
        modalContent.style.transform = 'translateY(0)';
    });
    
    // Focus input after modal is visible
    setTimeout(() => {
        pathInput.focus();
    }, 300);
}

// Close the add path modal
function closeAddPathModal() {
    const modal = document.getElementById('add-path-modal');
    const modalContent = modal.querySelector('.modal-content');
    
    if (!modal) {
        console.error("Add path modal not found");
        return;
    }
    
    document.body.classList.remove('no-scroll');
    modal.style.opacity = '0';
    modalContent.style.transform = 'scale(0.8)';
    
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

// Show remove confirmation modal
function showRemoveConfirmation(path) {
    pathToRemove = path;
    
    const modal = document.getElementById('confirmation-modal');
    const modalContent = modal.querySelector('.modal-content');
    const pathElement = document.getElementById('path-to-remove');
    
    if (!modal) {
        console.error("Confirmation modal not found");
        return;
    }
    
    // Set the path text
    pathElement.textContent = path;
    // Show modal with animation
    modal.style.display = 'flex';
    document.body.classList.add('no-scroll');
    // Force reflow to ensure transition works
    void modal.offsetWidth;
    
    modal.style.opacity = '1';
    modalContent.style.transform = 'scale(1)';
}

// Close the confirmation modal
function closeConfirmationModal(confirmed = false) {
    const modal = document.getElementById('confirmation-modal');
    const modalContent = modal.querySelector('.modal-content');
    
    if (!modal) {
        console.error("Confirmation modal not found");
        return;
    }
    
    document.body.classList.remove('no-scroll');
    modal.style.opacity = '0';
    modalContent.style.transform = 'scale(0.8)';
    
    setTimeout(() => {
        modal.style.display = 'none';
        
        // If confirmed, remove the path
        if (confirmed && pathToRemove) {
            removeWhiteoutPath(pathToRemove);
            pathToRemove = null;
        }
    }, 300);
}

// Init event listeners
function initEventListeners() {
    console.log("Initializing event listeners");
    
    // Add Path button
    const addButton = document.getElementById('add-path-button');
    console.log("Add button:", addButton); // Debug logging
    
    if (addButton) {
        // Use both click and touchend for better mobile support
        addButton.addEventListener('click', function(e) {
            console.log("Add button clicked");
            e.preventDefault(); // Prevent default anchor behavior
            showAddPathModal();
        });
        
        addButton.addEventListener('touchend', function(e) {
            console.log("Add button touched");
            e.preventDefault(); // Prevent default anchor behavior
            showAddPathModal();
        });
    } else {
        console.error("Add button not found in the DOM");
    }
    
    // Add Path Modal: Confirm button
    const confirmAddButton = document.getElementById('confirm-add');
    if (confirmAddButton) {
        confirmAddButton.addEventListener('click', async function() {
            const pathInput = document.getElementById('path-input');
            const success = await addWhiteoutPath(pathInput.value.trim());
            if (success) {
                closeAddPathModal();
            }
        });
    }
    
    // Add Path Modal: Cancel button
    const cancelAddButton = document.getElementById('cancel-add');
    if (cancelAddButton) {
        cancelAddButton.addEventListener('click', function() {
            closeAddPathModal();
        });
    }
    
    // Add Path Modal: Close button
    const closeAddButton = document.querySelector('#add-path-modal .close-modal');
    if (closeAddButton) {
        closeAddButton.addEventListener('click', function() {
            closeAddPathModal();
        });
    }
    
    // Confirmation Modal: Confirm button
    const confirmRemoveButton = document.getElementById('confirm-action');
    if (confirmRemoveButton) {
        confirmRemoveButton.addEventListener('click', function() {
            closeConfirmationModal(true);
        });
    }
    
    // Confirmation Modal: Cancel button
    const cancelRemoveButton = document.getElementById('cancel-action');
    if (cancelRemoveButton) {
        cancelRemoveButton.addEventListener('click', function() {
            closeConfirmationModal(false);
        });
    }
    
    // Confirmation Modal: Close button
    const closeConfirmButton = document.querySelector('#confirmation-modal .close-modal');
    if (closeConfirmButton) {
        closeConfirmButton.addEventListener('click', function() {
            closeConfirmationModal(false);
        });
    }
    
    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                if (modal.id === 'add-path-modal') {
                    closeAddPathModal();
                } else if (modal.id === 'confirmation-modal') {
                    closeConfirmationModal(false);
                }
            }
        });
    });
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const whiteoutButton = document.querySelector('.focus-btn');
        if (whiteoutButton) {
            whiteoutButton.style.paddingLeft = "25px";
            whiteoutButton.style.paddingRight = "25px";
        }
    }, 10);
    setupSearch();
    setupScrollEvent();
    applyRippleEffect();
    checkMMRL();
    initEventListeners();
    setTimeout(() => {
        fetchWhiteoutPaths();
    }, 150);
});
