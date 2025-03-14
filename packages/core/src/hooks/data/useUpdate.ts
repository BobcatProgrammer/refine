import { useMutation, UseMutationResult, useQueryClient } from "react-query";

import { ActionTypes } from "@contexts/undoableQueue";
import {
    BaseRecord,
    BaseKey,
    UpdateResponse,
    MutationMode,
    PrevContext as UpdateContext,
    HttpError,
    SuccessErrorNotification,
    MetaDataQuery,
    PreviousQuery,
    GetListResponse,
} from "../../interfaces";
import pluralize from "pluralize";
import {
    useMutationMode,
    useCancelNotification,
    useTranslate,
    useCheckError,
    usePublish,
    useHandleNotification,
    useDataProvider,
} from "@hooks";
import { queryKeys } from "@definitions/helpers";

type UpdateParams<TVariables> = {
    id: BaseKey;
    resource: string;
    mutationMode?: MutationMode;
    undoableTimeout?: number;
    onCancel?: (cancelMutation: () => void) => void;
    values: TVariables;
    metaData?: MetaDataQuery;
    dataProviderName?: string;
} & SuccessErrorNotification;

export type UseUpdateReturnType<
    TData extends BaseRecord = BaseRecord,
    TError extends HttpError = HttpError,
    TVariables = {},
> = UseMutationResult<
    UpdateResponse<TData>,
    TError,
    UpdateParams<TVariables>,
    UpdateContext<TData>
>;

/**
 * `useUpdate` is a modified version of `react-query`'s {@link https://react-query.tanstack.com/reference/useMutation `useMutation`} for update mutations.
 *
 * It uses `update` method as mutation function from the `dataProvider` which is passed to `<Refine>`.
 *
 * @see {@link https://refine.dev/docs/api-references/hooks/data/useUpdate} for more details.
 *
 * @typeParam TData - Result data of the query extends {@link https://refine.dev/docs/api-references/interfaceReferences#baserecord `BaseRecord`}
 * @typeParam TError - Custom error object that extends {@link https://refine.dev/docs/api-references/interfaceReferences#httperror `HttpError`}
 * @typeParam TVariables - Values for mutation function
 *
 */
export const useUpdate = <
    TData extends BaseRecord = BaseRecord,
    TError extends HttpError = HttpError,
    TVariables = {},
>(): UseUpdateReturnType<TData, TError, TVariables> => {
    const queryClient = useQueryClient();
    const dataProvider = useDataProvider();

    const {
        mutationMode: mutationModeContext,
        undoableTimeout: undoableTimeoutContext,
    } = useMutationMode();
    const translate = useTranslate();
    const { mutate: checkError } = useCheckError();
    const publish = usePublish();
    const { notificationDispatch } = useCancelNotification();
    const handleNotification = useHandleNotification();

    const mutation = useMutation<
        UpdateResponse<TData>,
        TError,
        UpdateParams<TVariables>,
        UpdateContext<TData>
    >(
        ({
            id,
            values,
            resource,
            mutationMode,
            undoableTimeout,
            onCancel,
            metaData,
            dataProviderName,
        }) => {
            const mutationModePropOrContext =
                mutationMode ?? mutationModeContext;

            const undoableTimeoutPropOrContext =
                undoableTimeout ?? undoableTimeoutContext;

            if (!(mutationModePropOrContext === "undoable")) {
                return dataProvider(dataProviderName).update<TData, TVariables>(
                    {
                        resource,
                        id,
                        variables: values,
                        metaData,
                    },
                );
            }
            const updatePromise = new Promise<UpdateResponse<TData>>(
                (resolve, reject) => {
                    const doMutation = () => {
                        dataProvider(dataProviderName)
                            .update<TData, TVariables>({
                                resource,
                                id,
                                variables: values,
                                metaData,
                            })
                            .then((result) => resolve(result))
                            .catch((err) => reject(err));
                    };

                    const cancelMutation = () => {
                        reject({ message: "mutationCancelled" });
                    };

                    if (onCancel) {
                        onCancel(cancelMutation);
                    }

                    notificationDispatch({
                        type: ActionTypes.ADD,
                        payload: {
                            id: id,
                            resource: resource,
                            cancelMutation: cancelMutation,
                            doMutation: doMutation,
                            seconds: undoableTimeoutPropOrContext,
                            isSilent: !!onCancel,
                        },
                    });
                },
            );
            return updatePromise;
        },
        {
            onMutate: async ({
                resource,
                id,
                mutationMode,
                values,
                dataProviderName,
            }) => {
                const queryKey = queryKeys(resource, dataProviderName);

                const previousQueries: PreviousQuery<TData>[] =
                    queryClient.getQueriesData(queryKey.resourceAll);

                const mutationModePropOrContext =
                    mutationMode ?? mutationModeContext;

                await queryClient.cancelQueries(
                    queryKey.resourceAll,
                    undefined,
                    {
                        silent: true,
                    },
                );

                if (!(mutationModePropOrContext === "pessimistic")) {
                    // Set the previous queries to the new ones:
                    queryClient.setQueriesData(
                        queryKey.list(),
                        (previous?: GetListResponse<TData> | null) => {
                            if (!previous) {
                                return null;
                            }
                            const data = previous.data.map((record: TData) => {
                                if (record.id?.toString() === id?.toString()) {
                                    return {
                                        id,
                                        ...values,
                                    } as unknown as TData;
                                }
                                return record;
                            });

                            return {
                                ...previous,
                                data,
                            };
                        },
                    );

                    queryClient.setQueriesData(
                        queryKey.many(),
                        (previous?: GetListResponse<TData> | null) => {
                            if (!previous) {
                                return null;
                            }

                            const data = previous.data.map((record: TData) => {
                                if (record.id?.toString() === id?.toString()) {
                                    record = {
                                        id,
                                        ...values,
                                    } as unknown as TData;
                                }
                                return record;
                            });
                            return {
                                ...previous,
                                data,
                            };
                        },
                    );

                    queryClient.setQueriesData(
                        queryKey.detail(id),
                        (previous?: GetListResponse<TData> | null) => {
                            if (!previous) {
                                return null;
                            }

                            return {
                                ...previous,
                                data: {
                                    ...previous.data,
                                    ...values,
                                },
                            };
                        },
                    );
                }

                return {
                    previousQueries,
                    queryKey,
                };
            },
            onSettled: (_data, _error, { id, resource }, context) => {
                // invalidate the cache for the list and many queries:

                queryClient.invalidateQueries(context?.queryKey.list());
                queryClient.invalidateQueries(context?.queryKey.many());
                queryClient.invalidateQueries(context?.queryKey.detail(id));

                notificationDispatch({
                    type: ActionTypes.REMOVE,
                    payload: { id, resource },
                });
            },
            onSuccess: (data, { id, resource, successNotification }) => {
                const resourceSingular = pluralize.singular(resource);

                handleNotification(successNotification, {
                    key: `${id}-${resource}-notification`,
                    description: translate(
                        "notifications.success",
                        "Successful",
                    ),
                    message: translate(
                        "notifications.editSuccess",
                        {
                            resource: translate(
                                `${resource}.${resource}`,
                                resourceSingular,
                            ),
                        },
                        `Successfully updated ${resourceSingular}`,
                    ),
                    type: "success",
                });

                publish?.({
                    channel: `resources/${resource}`,
                    type: "updated",
                    payload: {
                        ids: data.data?.id ? [data.data.id] : undefined,
                    },
                    date: new Date(),
                });
            },
            onError: (
                err: TError,
                { id, resource, errorNotification },
                context,
            ) => {
                // set back the queries to the context:

                if (context) {
                    for (const query of context.previousQueries) {
                        queryClient.setQueryData(query[0], query[1]);
                    }
                }

                if (err.message !== "mutationCancelled") {
                    checkError?.(err);

                    const resourceSingular = pluralize.singular(resource);

                    handleNotification(errorNotification, {
                        key: `${id}-${resource}-notification`,
                        message: translate(
                            "notifications.editError",
                            {
                                resource: translate(
                                    `${resource}.${resource}`,
                                    resourceSingular,
                                ),
                                statusCode: err.statusCode,
                            },
                            `Error when updating ${resourceSingular} (status code: ${err.statusCode})`,
                        ),
                        description: err.message,
                        type: "error",
                    });
                }
            },
        },
    );

    return mutation;
};
