#!/bin/bash

# Exit on error
set -e

# Function to create a new branch
create_branch() {
    local branch_name=$1
    local base_branch=${2:-main}
    
    echo "Creating branch: $branch_name from $base_branch"
    
    # Fetch latest changes
    git fetch origin "$base_branch"
    
    # Create and checkout new branch
    git checkout -b "$branch_name" "origin/$base_branch"
}

# Function to commit changes
commit_changes() {
    local message=$1
    local files=("${@:2}")
    
    echo "Committing changes..."
    
    # Add files
    for file in "${files[@]}"; do
        if [ -f "$file" ] || [ -d "$file" ]; then
            git add "$file"
        else
            echo "Warning: File $file does not exist"
        fi
    done
    
    # Commit changes
    git commit -m "$message"
}

# Function to push changes
push_changes() {
    local branch_name=$1
    
    echo "Pushing changes to $branch_name..."
    git push origin "$branch_name"
}

# Function to create PR
create_pull_request() {
    local title=$1
    local body=$2
    local head_branch=$3
    local base_branch=${4:-main}
    local labels=("${@:5}")
    
    echo "Creating pull request..."
    
    # Create PR
    local pr_url=$(gh pr create \
        --title "$title" \
        --body "$body" \
        --head "$head_branch" \
        --base "$base_branch" \
        --label "${labels[@]}" \
        --json url \
        --jq .url)
    
    echo "Created pull request: $pr_url"
    echo "$pr_url"
}

# Function to add reviewers
add_reviewers() {
    local pr_number=$1
    local reviewers=("${@:2}")
    
    if [ ${#reviewers[@]} -gt 0 ]; then
        echo "Adding reviewers..."
        gh pr edit "$pr_number" --add-reviewer "${reviewers[@]}"
    fi
}

# Function to add assignees
add_assignees() {
    local pr_number=$1
    local assignees=("${@:2}")
    
    if [ ${#assignees[@]} -gt 0 ]; then
        echo "Adding assignees..."
        gh pr edit "$pr_number" --add-assignee "${assignees[@]}"
    fi
}

# Main function
main() {
    # Parse command line arguments
    local branch_name=""
    local title=""
    local body=""
    local base_branch="main"
    local labels=()
    local reviewers=()
    local assignees=()
    local files=()
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --branch)
                branch_name="$2"
                shift 2
                ;;
            --title)
                title="$2"
                shift 2
                ;;
            --body)
                body="$2"
                shift 2
                ;;
            --base)
                base_branch="$2"
                shift 2
                ;;
            --label)
                labels+=("$2")
                shift 2
                ;;
            --reviewer)
                reviewers+=("$2")
                shift 2
                ;;
            --assignee)
                assignees+=("$2")
                shift 2
                ;;
            --file)
                files+=("$2")
                shift 2
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 --branch <branch-name> --title <title> --body <body> [--base <base-branch>] [--label <label>] [--reviewer <reviewer>] [--assignee <assignee>] [--file <file>]"
                exit 1
                ;;
        esac
    done
    
    # Validate required arguments
    if [ -z "$branch_name" ]; then
        echo "Error: --branch is required"
        exit 1
    fi
    
    if [ -z "$title" ]; then
        echo "Error: --title is required"
        exit 1
    fi
    
    if [ -z "$body" ]; then
        echo "Error: --body is required"
        exit 1
    fi
    
    echo "Starting PR creation process..."
    
    # Create branch
    create_branch "$branch_name" "$base_branch"
    
    # Commit changes if files are specified
    if [ ${#files[@]} -gt 0 ]; then
        commit_changes "$title" "${files[@]}"
    fi
    
    # Push changes
    push_changes "$branch_name"
    
    # Create PR
    pr_url=$(create_pull_request "$title" "$body" "$branch_name" "$base_branch" "${labels[@]}")
    pr_number=$(echo "$pr_url" | grep -o '[0-9]*$')
    
    # Add reviewers and assignees
    add_reviewers "$pr_number" "${reviewers[@]}"
    add_assignees "$pr_number" "${assignees[@]}"
    
    echo "Successfully created pull request: $pr_url"
}

# Run main function with all arguments
main "$@" 