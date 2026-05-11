#!/usr/bin/env python3
"""
agent-fleet CLI

Usage:
  python run.py dispatch              Start dispatcher loop (polls GitHub Issues)
  python run.py dispatch --once       Process all claimable issues once and exit
  python run.py inspect code          Run Code Quality Inspector (creates issues)
  python run.py inspect code --dry    Dry run: print issues without creating them
  python run.py setup-labels          Create required GitHub labels on the target repo
  python run.py status                Show open fleet issues and active agents
"""

import argparse
import sys
import tomllib
from pathlib import Path


def load_config() -> dict:
    config_file = Path(__file__).parent / "config.toml"
    if not config_file.exists():
        example = Path(__file__).parent / "config.toml.example"
        print(f"ERROR: config.toml not found. Copy config.toml.example and edit it.", file=sys.stderr)
        if example.exists():
            print(f"  cp {example} {config_file}", file=sys.stderr)
        sys.exit(1)
    with open(config_file, "rb") as f:
        return tomllib.load(f)


def cmd_dispatch(args, config):
    from pathlib import Path
    from fleet import dispatcher
    repo = config["target_repo"]
    repo_path = Path(config["target_path"]).expanduser()
    if args.once:
        count = dispatcher.run_once(repo, repo_path)
        print(f"Processed {count} issue(s).")
    else:
        interval = config.get("poll_interval_seconds", 300)
        dispatcher.run_loop(repo, repo_path, interval)


def cmd_inspect(args, config):
    from pathlib import Path
    repo = config["target_repo"]
    repo_path = Path(config["target_path"]).expanduser()
    if args.inspector == "code":
        from fleet.inspector.code import run
        issues = run(repo, repo_path, dry_run=args.dry)
        print(f"\n{len(issues)} issue(s) {'would be ' if args.dry else ''}created.")
    else:
        print(f"Unknown inspector: {args.inspector}. Available: code", file=sys.stderr)
        sys.exit(1)


def cmd_setup_labels(args, config):
    from fleet.gh import ensure_labels
    repo = config["target_repo"]
    print(f"Creating labels on {repo}...")
    ensure_labels(repo)
    print("Done.")


def cmd_status(args, config):
    from fleet.gh import list_open_issues
    repo = config["target_repo"]
    print(f"\n=== Fleet status: {repo} ===\n")

    in_progress = list_open_issues(repo, label="agent:in-progress")
    print(f"Active agents ({len(in_progress)}):")
    for i in in_progress:
        print(f"  #{i.number} {i.title}")

    ready = list_open_issues(repo, label="agent:code", exclude_label="agent:in-progress")
    print(f"\nReady issues ({len(ready)}):")
    for i in ready:
        print(f"  #{i.number} {i.title}")


def main():
    parser = argparse.ArgumentParser(description="Autonomous Agent Fleet CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    p_dispatch = sub.add_parser("dispatch", help="Start dispatcher")
    p_dispatch.add_argument("--once", action="store_true", help="Process once and exit")

    p_inspect = sub.add_parser("inspect", help="Run an inspector")
    p_inspect.add_argument("inspector", choices=["code"], help="Inspector type")
    p_inspect.add_argument("--dry", action="store_true", help="Dry run — don't create issues")

    sub.add_parser("setup-labels", help="Create GitHub labels on target repo")
    sub.add_parser("status", help="Show fleet status")

    args = parser.parse_args()
    config = load_config()

    if args.command == "dispatch":
        cmd_dispatch(args, config)
    elif args.command == "inspect":
        cmd_inspect(args, config)
    elif args.command == "setup-labels":
        cmd_setup_labels(args, config)
    elif args.command == "status":
        cmd_status(args, config)


if __name__ == "__main__":
    main()
