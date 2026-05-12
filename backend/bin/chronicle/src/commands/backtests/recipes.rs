//! `chronicle recipes init` — scaffold a working recipe + tests dir.
//!
//! Output layout for `chronicle recipes init my-eval.toml`:
//!
//!   my-eval.toml          (recipe)
//!   my-eval.tests/test.sh (verifier script the recipe references)
//!
//! The recipe's `tests-dir` is filled in with the absolute path to
//! the scaffolded `tests/` directory, so the run-out-of-the-box flow
//! is `init → jobs run` with no editing required.

use crate::error::{CliError, Result};
use clap::Subcommand;
use colored::Colorize;
use std::path::{Path, PathBuf};

#[derive(Debug, Subcommand)]
pub enum RecipesCmd {
    /// Write a starter recipe.toml + matching tests/test.sh to the
    /// given path. Re-running on an existing path is rejected unless
    /// `--force` is set.
    Init {
        /// Output path for the recipe file. Defaults to `./recipe.toml`.
        #[arg(default_value = "recipe.toml")]
        path: PathBuf,
        /// Overwrite existing files (recipe + tests dir).
        #[arg(long, default_value_t = false)]
        force: bool,
        /// Scaffold a recipe that pulls cases from a Chronicle dataset
        /// (one trial per trace) instead of an explicit `[[cases]]`
        /// block. Pass the dataset id (e.g. `ds_demo`).
        #[arg(long, value_name = "DATASET_ID")]
        from_dataset: Option<String>,
    },
}

const RECIPE_TEMPLATE: &str = include_str!("../../../templates/recipe.starter.toml");
const RECIPE_DATASET_TEMPLATE: &str =
    include_str!("../../../templates/recipe.starter.dataset.toml");
const TEST_SCRIPT_TEMPLATE: &str =
    include_str!("../../../templates/test.starter.sh");

pub fn run(cmd: RecipesCmd) -> Result<()> {
    match cmd {
        RecipesCmd::Init {
            path,
            force,
            from_dataset,
        } => init(path, force, from_dataset),
    }
}

fn init(recipe_path: PathBuf, force: bool, from_dataset: Option<String>) -> Result<()> {
    // Resolve to absolute paths up front so the recipe records a
    // path the orchestrator (which runs separately from the CLI) can
    // read regardless of its cwd.
    let recipe_abs = absolutize(&recipe_path)?;
    let tests_dir_abs = compute_tests_dir(&recipe_abs);
    let test_sh_path = tests_dir_abs.join("test.sh");

    if !force {
        if recipe_abs.exists() {
            return Err(CliError::config(format!(
                "{} already exists; pass --force to overwrite",
                recipe_abs.display()
            )));
        }
        if test_sh_path.exists() {
            return Err(CliError::config(format!(
                "{} already exists; pass --force to overwrite",
                test_sh_path.display()
            )));
        }
    }

    // 1. Write the tests dir + test.sh first so a partial failure
    //    leaves nothing referencing the recipe.
    std::fs::create_dir_all(&tests_dir_abs)?;
    std::fs::write(&test_sh_path, TEST_SCRIPT_TEMPLATE)?;
    set_executable(&test_sh_path)?;

    // 2. Substitute the tests-dir placeholder + write the recipe.
    //    The dataset variant additionally substitutes the dataset id
    //    so the user can `chronicle jobs run` with no edits.
    let template = if from_dataset.is_some() {
        RECIPE_DATASET_TEMPLATE
    } else {
        RECIPE_TEMPLATE
    };
    let recipe_body = template
        .replace("{{TESTS_DIR}}", &tests_dir_abs.to_string_lossy())
        .replace(
            "{{DATASET_ID}}",
            from_dataset.as_deref().unwrap_or("ds_demo"),
        );
    std::fs::write(&recipe_abs, recipe_body)?;

    println!(
        "{} wrote starter recipe to {}",
        "✓".green().bold(),
        recipe_abs.display()
    );
    println!(
        "{} wrote starter test.sh to {}",
        "✓".green().bold(),
        test_sh_path.display()
    );
    println!();
    println!("  next:");
    println!(
        "    chronicle jobs run {} --follow",
        recipe_abs.display()
    );
    println!();
    if let Some(ds) = &from_dataset {
        println!(
            "  {}",
            format!(
                "this recipe pulls cases from dataset '{ds}' — backend will derive \
                 one trial per trace at submission time."
            )
            .dimmed()
        );
        println!(
            "  {}",
            "rubric grading uses ANTHROPIC_API_KEY on the backend; without it the \
             orchestrator falls back to MockGrader."
                .dimmed()
        );
    }
    println!(
        "  {}",
        "this recipe uses sandbox-driver=daytona — set DAYTONA_API_KEY".dimmed()
    );
    println!(
        "  {}",
        "on the backend (chronicle-backend) before running.".dimmed()
    );
    Ok(())
}

/// Convert a path to absolute, anchored at the current working dir
/// when relative.
fn absolutize(p: &Path) -> Result<PathBuf> {
    if p.is_absolute() {
        return Ok(p.to_path_buf());
    }
    let cwd = std::env::current_dir().map_err(|e| {
        CliError::config(format!("could not read current dir: {e}"))
    })?;
    Ok(cwd.join(p))
}

/// Pick a tests-dir name next to the recipe. For `foo.toml` we use
/// `foo.tests/`; for plain `recipe.toml` we use `recipe.tests/`. The
/// `.tests` suffix keeps the two pieces obviously paired without
/// hiding the dir.
fn compute_tests_dir(recipe_abs: &Path) -> PathBuf {
    let stem = recipe_abs
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "recipe".to_string());
    let parent = recipe_abs
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    parent.join(format!("{stem}.tests"))
}

#[cfg(unix)]
fn set_executable(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let mut perms = std::fs::metadata(path)?.permissions();
    perms.set_mode(0o755);
    std::fs::set_permissions(path, perms)?;
    Ok(())
}

#[cfg(not(unix))]
fn set_executable(_path: &Path) -> Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tests_dir_pairs_with_recipe_stem() {
        let recipe = PathBuf::from("/tmp/x/my-eval.toml");
        assert_eq!(
            compute_tests_dir(&recipe),
            PathBuf::from("/tmp/x/my-eval.tests")
        );
    }

    #[test]
    fn tests_dir_handles_no_extension() {
        let recipe = PathBuf::from("/tmp/x/recipe");
        assert_eq!(
            compute_tests_dir(&recipe),
            PathBuf::from("/tmp/x/recipe.tests")
        );
    }
}
