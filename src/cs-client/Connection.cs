using Newtonsoft.Json.Linq;
using OpenFin.FDC3.Constants;
using OpenFin.FDC3.Context;
using OpenFin.FDC3.Intents;
using OpenFin.FDC3.Payloads;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Openfin.Desktop.Messaging;
using Openfin.Desktop;
using OpenFin.FDC3.Channels;

namespace OpenFin.FDC3
{
    internal static class Connection
    {
        internal static Action<Exception> ConnectionInitializationComplete;
        private static ChannelClient channelClient;
        private static Action<ChannelChangedPayload> channelChangedHandlers { get; set; }
        private static Action<ContextBase> contextListeners { get; set; }
        private static List<KeyValuePair<string, Action<ContextBase>>> intentListeners { get; set; }
        internal static void AddChannelChangedEventListener(Action<ChannelChangedPayload> handler)
        {
            channelChangedHandlers += handler;
        }

        internal static void AddContextListener(Action<ContextBase> handler)
        {
            contextListeners += handler;
        }

        internal static void AddIntentListener(string intent, Action<ContextBase> handler)
        {
            intentListeners.Add(new KeyValuePair<string, Action<ContextBase>>(intent, handler));
        }

        internal static Task Broadcast(Context.ContextBase context)
        {
            return channelClient.DispatchAsync<Task>(ApiTopic.Broadcast, context);
        }

        internal static Task<AppIntent> FindIntent(string intent, ContextBase context)
        {
            return channelClient.DispatchAsync<AppIntent>(ApiTopic.FindIntent, new { intent, context });
        }

        internal static Task<AppIntent[]> FindIntentsByContext(ContextBase context)
        {
            return channelClient.DispatchAsync<AppIntent[]>(ApiTopic.FindIntentsByContext, context);
        }

        internal static Task<Channel[]> GetAllChannels()
        {
            return channelClient.DispatchAsync<Channel[]>(ApiTopic.GetAllChannels, JValue.CreateUndefined());
        }

        internal static Task<Channel> GetChannelAsync(Identity identity)
        {
            if (identity == null)
            {
                return channelClient.DispatchAsync<Channel>(ApiTopic.GetChannel, JValue.CreateUndefined());
            }
            else
            {
                return channelClient.DispatchAsync<Channel>(ApiTopic.GetChannel, new { identity });
            }
        }

        internal static Task<Identity[]> GetChannelMembersAsync(string id)
        {
            return channelClient.DispatchAsync<Identity[]>(ApiTopic.GetChannelMembers, new { id });
        }

        internal static void Initialize(Runtime runtimeInstance)
        {
            intentListeners = new List<KeyValuePair<string, Action<ContextBase>>>();
            channelClient = runtimeInstance.InterApplicationBus.Channel.CreateClient(Fdc3ServiceConstants.ServiceChannel);

            registerChannelTopics();
            
            channelClient.ConnectAsync().ContinueWith(x =>
            {
                if (x.Exception == null)
                    ConnectionInitializationComplete?.Invoke(x.Exception);              
            });
        }
        internal static Task JoinChannelAsync(string id, Identity identity)
        {
            return channelClient.DispatchAsync(ApiTopic.JoinChannel, new { id, identity });
        }
        internal static Task OpenAsync(string name, ContextBase context = null)
        {
            return channelClient.DispatchAsync<string>(ApiTopic.Open, new { name, context });
        }
        internal static Task<IntentResolution> RaiseIntent(string intent, ContextBase context, string target)
        {
            return channelClient.DispatchAsync<IntentResolution>(ApiTopic.RaiseIntent, new { intent, context, target });
        }

        internal static void RemoveChannelChangedEventListener(Action<ChannelChangedPayload> handler)
        {
            channelChangedHandlers -= handler;
        }
        internal static void UnsubcribeContextListener(Action<ContextBase> handler)
        {
            contextListeners -= handler;
        }
        internal static void UnsubscribeIntentListener(string intent)
        {
            intentListeners.RemoveAll(x => x.Key == intent);
        }

        internal static void UnsubscribeIntentListener(string intent, Action<ContextBase> handler)
        {
            intentListeners.RemoveAll(x => x.Key == intent && x.Value == handler);
        }
        private static void registerChannelTopics()
        {
            if (channelClient == null)
            {
                throw new NullReferenceException("ChannelClient must be created before registering topics.");
            }

            channelClient.RegisterTopic<RaiseIntentPayload, object>(ChannelTopicConstants.Intent, payload =>
            {
                var listeners = intentListeners.Where(x => x.Key == payload.Intent).ToList();
                listeners.ForEach(x => x.Value?.Invoke(payload.Context));
                return null;
            });

            channelClient.RegisterTopic<ContextBase, object>(ChannelTopicConstants.Context, payload =>
            {
                contextListeners?.Invoke(payload);
                return null;
            });

            channelClient.RegisterTopic<ChannelChangedPayload, object>(ChannelTopicConstants.Event, @event =>
            {
                channelChangedHandlers?.Invoke(@event);
                return null;
            });
        }
    }
}