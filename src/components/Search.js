const Search = () => {
    return (
        <header>
            <h2 className="header__title">Request. Verify. Issue.</h2>
            <input
                type="text"
                className="header__search"
                placeholder="Search by medicine name, batch ID, or manufacturer"
            />
        </header>
    );
}

export default Search;