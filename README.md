# Munidiff timeline client

This is a web-based client that allows exploring the history of models stored in a GitHub repository.

The explorer can be accessed in this website: https://munidiff.github.io/

## How to use

1. Provide a URL to a GitHub commit. You can pre-load the explorer with an example URL by [using this link](https://munidiff.github.io/?url=https://github.com/alfonsodelavega/modiff/commit/c6b3418f4ec71c329f06fab594b526f41cb687bf).

2. After providing a URL, hit the search icon on the right of the search bar. A list of commits should appear on the left, with the details of the commit from the URL appearing below the search bar, including a list of changed models.

3. Click on any of the changed models to see the difference reports below. It might take a while to appear, as the Google Cloud Functions starts and answer the query.

4. The graphical and textual reports should appear.

5. You can click any of the commit messages on the left to change the focus to that commit, and repeat the process.
