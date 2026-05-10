import os
import argparse

# Files that shouldn't prevent a folder from being considered "empty"
# Especially useful for Google Cloud / macOS / Windows cross-platform usage
COMMON_HIDDEN_FILES = {'.ds_store', 'desktop.ini', 'thumbs.db'}

def is_folder_empty(dirpath, ignore_hidden=True):
    try:
        entries = os.listdir(dirpath)
    except PermissionError:
        print(f"Skipping (Permission Denied): {dirpath}")
        return False
        
    if not entries:
        return True
        
    if ignore_hidden:
        for entry in entries:
            entry_path = os.path.join(dirpath, entry)
            # If there's a sub-directory, it's not empty (even if the sub-directory is empty).
            # We evaluate bottom-up, so child empty dirs will be prepended with E_ before this parent is checked.
            if os.path.isdir(entry_path):
                return False
            # If it's a file but NOT a common hidden file, it's not empty
            if entry.lower() not in COMMON_HIDDEN_FILES:
                return False
        return True # Only hidden files were found
    
    return False

def mark_empty_folders(root_dir, dry_run=True, ignore_hidden=True):
    if not os.path.isdir(root_dir):
        print(f"Error: Directory '{root_dir}' does not exist.")
        return

    renamed_count = 0
    target_folders = []
    
    print(f"Starting {'DRY RUN' if dry_run else 'REAL RUN'} in {root_dir}")
    print("-" * 60)
    
    # topdown=False ensures we process subdirectories before their parent directories.
    for dirpath, dirnames, filenames in os.walk(root_dir, topdown=False):
        # We only care about the folder itself
        folder_name = os.path.basename(dirpath)
        
        # Don't rename if it already starts with E_
        if folder_name.startswith("E_"):
            continue
            
        if is_folder_empty(dirpath, ignore_hidden):
            parent_dir = os.path.dirname(dirpath)
            new_folder_name = "E_" + folder_name
            new_dirpath = os.path.join(parent_dir, new_folder_name)
            
            target_folders.append((dirpath, new_dirpath))

    # Process renamings
    for old_path, new_path in target_folders:
        if dry_run:
            print(f"[DRY RUN] Would rename: {old_path}\n             -> {new_path}")
        else:
            try:
                os.rename(old_path, new_path)
                print(f"[RENAMED] {old_path}\n       -> {new_path}")
                renamed_count += 1
            except Exception as e:
                print(f"[ERROR] Failed renaming {old_path}: {e}")

    print("-" * 60)
    if dry_run:
        print(f"Dry run complete. Found {len(target_folders)} folders that would have been renamed.")
        print("To actually rename these folders, run the script with the --execute flag.")
    else:
        print(f"Real run complete. Successfully renamed {renamed_count} folders.")


def main():
    parser = argparse.ArgumentParser(description="Recursively mark empty folders with an 'E_' prefix.")
    parser.add_argument("target_dir", help="Path to the directory to scan")
    parser.add_argument("--execute", action="store_true", help="Perform the actual renaming. If omitted, performs a dry run.")
    parser.add_argument("--no-ignore-hidden", action="store_true", help="Do not ignore common hidden OS files (like .DS_Store). Treat folders with them as non-empty.")
    
    args = parser.parse_args()
    
    # We default to dry-run being TRUE unless --execute is specified.
    dry_run = not args.execute
    ignore_hidden = not args.no_ignore_hidden
    
    # Resolve absolute path for clarity
    target_abs = os.path.abspath(args.target_dir)
    mark_empty_folders(target_abs, dry_run=dry_run, ignore_hidden=ignore_hidden)

if __name__ == "__main__":
    main()
