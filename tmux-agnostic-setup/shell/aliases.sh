# tmux-agnostic-setup — shell aliases. Sourced from ~/.zshrc / ~/.bashrc by install.sh.
alias proj='~/.config/tmux/proj.sh'
alias g='~/.config/tmux/layouts/grid.sh'
alias g+='~/.config/tmux/layouts/grid.sh + $([ -n "$TMUX" ] && tmux display-message -p "#S" || echo grid)'
alias g-='~/.config/tmux/layouts/grid.sh - $([ -n "$TMUX" ] && tmux display-message -p "#S" || echo grid)'
