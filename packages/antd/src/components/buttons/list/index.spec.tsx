import React from "react";
import { Route } from "react-router-dom";

import { fireEvent, render, TestWrapper, waitFor } from "@test";
import { ListButton } from "./";

describe("List Button", () => {
    const list = jest.fn();

    it("should render button successfuly", () => {
        const { container, getByText } = render(
            <ListButton onClick={() => list()} resourceName="posts-light" />,
            {
                wrapper: TestWrapper({
                    resources: [{ name: "posts-light" }],
                }),
            },
        );

        getByText("Posts lights");

        expect(container).toBeTruthy();
    });

    it("should render label as children if specified", async () => {
        const { container, getByText } = render(
            <Route path="/:resource">
                <ListButton />
            </Route>,
            {
                wrapper: TestWrapper({
                    resources: [{ name: "posts", options: { label: "test" } }],
                    routerInitialEntries: ["/posts"],
                }),
            },
        );

        expect(container).toBeTruthy();
        getByText("Tests");
    });

    it("should render text by children", () => {
        const { container, getByText } = render(
            <ListButton>refine</ListButton>,
            {
                wrapper: TestWrapper({
                    resources: [{ name: "posts" }],
                }),
            },
        );

        expect(container).toBeTruthy();

        getByText("refine");
    });

    it("should render without text show only icon", () => {
        const { container, queryByText } = render(<ListButton hideText />, {
            wrapper: TestWrapper({
                resources: [{ name: "posts" }],
            }),
        });

        expect(container).toBeTruthy();

        expect(queryByText("Posts")).not.toBeInTheDocument();
    });

    it("should be disabled when user not have access", async () => {
        const { container, getByText } = render(<ListButton>List</ListButton>, {
            wrapper: TestWrapper({
                resources: [{ name: "posts" }],
                accessControlProvider: {
                    can: () => Promise.resolve({ can: false }),
                },
            }),
        });

        expect(container).toBeTruthy();

        await waitFor(() =>
            expect(getByText("List").closest("button")).toBeDisabled(),
        );
    });

    it("should skip access control", async () => {
        const { container, getByText } = render(
            <ListButton ignoreAccessControlProvider>List</ListButton>,
            {
                wrapper: TestWrapper({
                    resources: [{ name: "posts" }],
                    accessControlProvider: {
                        can: () => Promise.resolve({ can: false }),
                    },
                }),
            },
        );

        expect(container).toBeTruthy();

        await waitFor(() =>
            expect(getByText("List").closest("button")).not.toBeDisabled(),
        );
    });

    it("should successfully return disabled button custom title", async () => {
        const { container, getByText } = render(<ListButton>List</ListButton>, {
            wrapper: TestWrapper({
                resources: [{ name: "posts" }],
                accessControlProvider: {
                    can: () =>
                        Promise.resolve({
                            can: false,
                            reason: "Access Denied",
                        }),
                },
            }),
        });

        expect(container).toBeTruthy();

        await waitFor(() =>
            expect(getByText("List").closest("button")).not.toBeDisabled(),
        );
        await waitFor(() =>
            expect(
                getByText("List").closest("button")?.getAttribute("title"),
            ).toBe("Access Denied"),
        );
    });

    it("should render called function successfully if click the button", () => {
        const { getByText } = render(
            <ListButton onClick={() => list()} resourceName="posts" />,
            {
                wrapper: TestWrapper({
                    resources: [{ name: "posts" }],
                }),
            },
        );

        fireEvent.click(getByText("Posts"));

        expect(list).toHaveBeenCalledTimes(1);
    });
});
