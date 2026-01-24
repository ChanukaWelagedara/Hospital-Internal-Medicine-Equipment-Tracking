const Search = () => {
    return (
        <header className="w-full">
            <input
                type="text"
                className="w-full max-w-3xl mx-auto block px-4 py-2 border rounded-md bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                placeholder="Search by medicine name, batch ID, or manufacturer"
            />
        </header>
    );
}

export default Search;