"""
UK Visa Sponsor Finder (Streamlit version)
Search every UK company licensed to sponsor work visas,
using the official Home Office register of licensed sponsors.
"""
from pathlib import Path
from urllib.parse import quote_plus

import pandas as pd
import plotly.express as px
import streamlit as st

DATA_FILE = Path(__file__).parent / "data" / "sponsors.csv"
SOURCE_URL = "https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers"

st.set_page_config(page_title="UK Visa Sponsor Finder", page_icon="🇬🇧", layout="wide")


# ---------- 1. Load and clean the data (cached, so it only runs once) ----------
@st.cache_data
def load_data():
    df = pd.read_csv(DATA_FILE, dtype=str, encoding="utf-8-sig", encoding_errors="replace").fillna("")
    df.columns = [c.strip() for c in df.columns]
    df = df.rename(columns={
        "Organisation Name": "Company",
        "Town/City": "City",
        "Type & Rating": "Rating",
    })

    # Tidy spaces and capitals: "  LONDON " -> "London"
    for col in ["Company", "City", "County", "Rating", "Route"]:
        df[col] = df[col].str.strip().str.replace(r"\s+", " ", regex=True)
    df["City"] = df["City"].str.title()
    df["County"] = df["County"].str.title()
    df = df[df["Company"] != ""]

    # The CSV has one row per company PER visa route. Merge them so each company appears once.
    df["A_rated"] = df["Rating"].str.contains("(A", regex=False)
    companies = df.groupby(["Company", "City"], as_index=False).agg(
        County=("County", "max"),
        RouteList=("Route", lambda s: sorted(set(s) - {""})),
        A_rated=("A_rated", "any"),
    )
    companies["Routes"] = companies["RouteList"].str.join(", ")
    companies["Jobs"] = (
        "https://www.linkedin.com/jobs/search/?keywords=" + companies["Company"].map(quote_plus)
        + "&location=" + companies["City"].replace("", "United Kingdom").map(quote_plus)
    )

    route_counts = df.loc[df["Route"] != "", "Route"].value_counts()
    return companies, route_counts


companies, route_counts = load_data()


# ---------- 2. Header ----------
st.title("🇬🇧 UK Visa Sponsor Finder")
st.write(
    "Search every UK company licensed to sponsor work visas, using the official "
    f"[Home Office register]({SOURCE_URL})."
)


# ---------- 3. Filters (left sidebar) ----------
with st.sidebar:
    st.header("🔍 Filters")
    name_q = st.text_input("Company name", placeholder="e.g. NHS, Deloitte, Tesco")
    place_q = st.text_input("City or county", placeholder="e.g. London")
    route = st.selectbox(
        "Visa route",
        ["All routes"] + route_counts.index.tolist(),
        format_func=lambda r: r if r == "All routes" else f"{r} ({route_counts[r]:,})",
    )
    a_only = st.checkbox("A-rated sponsors only")
    st.caption("A-rated means the company is in good standing with the Home Office.")

mask = pd.Series(True, index=companies.index)
if name_q:
    mask &= companies["Company"].str.contains(name_q, case=False, regex=False)
if place_q:
    mask &= (
        companies["City"].str.contains(place_q, case=False, regex=False)
        | companies["County"].str.contains(place_q, case=False, regex=False)
    )
if route != "All routes":
    mask &= companies["RouteList"].apply(lambda routes: route in routes)
if a_only:
    mask &= companies["A_rated"]

results = companies[mask]


# ---------- 4. Headline numbers ----------
c1, c2, c3 = st.columns(3)
c1.metric("Sponsor companies (total)", f"{len(companies):,}")
c2.metric("Matching your search", f"{len(results):,}")
c3.metric("Towns and cities", f"{results.loc[results['City'] != '', 'City'].nunique():,}")


# ---------- 5. Results and insights ----------
tab_search, tab_insights = st.tabs(["📋 Companies", "📊 Insights"])

with tab_search:
    st.dataframe(
        results[["Company", "City", "County", "Routes", "A_rated", "Jobs"]],
        column_config={
            "A_rated": st.column_config.CheckboxColumn("A-rated"),
            "Jobs": st.column_config.LinkColumn("Jobs", display_text="Find jobs on LinkedIn →"),
        },
        hide_index=True,
        height=560,
    )
    st.download_button(
        "⬇️ Download these results (CSV)",
        results[["Company", "City", "County", "Routes", "A_rated"]].to_csv(index=False).encode("utf-8"),
        file_name="visa_sponsors.csv",
        mime="text/csv",
    )

with tab_insights:
    left, right = st.columns(2)

    top_cities = (
        results.loc[results["City"] != "", "City"].value_counts().head(10)
        .rename_axis("City").reset_index(name="Companies")
    )
    with left:
        st.subheader("Top 10 cities for visa sponsors")
        if top_cities.empty:
            st.info("No cities to show for this search.")
        else:
            fig = px.bar(top_cities, x="Companies", y="City", orientation="h", text="Companies")
            fig.update_layout(yaxis={"categoryorder": "total ascending"}, margin=dict(l=0, r=0, t=10, b=0))
            st.plotly_chart(fig, width="stretch")

    top_routes = (
        results["RouteList"].explode().dropna().value_counts().head(8)
        .rename_axis("Route").reset_index(name="Companies")
    )
    with right:
        st.subheader("Most common visa routes")
        if top_routes.empty:
            st.info("No routes to show for this search.")
        else:
            fig = px.bar(top_routes, x="Companies", y="Route", orientation="h", text="Companies")
            fig.update_layout(yaxis={"categoryorder": "total ascending"}, margin=dict(l=0, r=0, t=10, b=0))
            st.plotly_chart(fig, width="stretch")


# ---------- 6. Footer ----------
st.divider()
st.caption(
    f"Data: [Register of licensed sponsors: workers]({SOURCE_URL}) (GOV.UK, Open Government Licence). "
    "Always check the official register before applying."
)
