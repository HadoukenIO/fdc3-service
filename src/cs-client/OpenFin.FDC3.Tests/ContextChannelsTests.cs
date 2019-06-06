using System;
using System.Threading.Tasks;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Linq;
using OpenFin.FDC3.Channels;
using OpenFin.FDC3.Exceptions;

namespace OpenFin.FDC3.Tests
{
    [TestClass]
    public class ContextChannelsTests
    {  

        [TestMethod]
        public async Task GetAllChannelsAsync_GettingAvailableChannels_ReturnsChannelsList()
        {
            init();
            var channels = await DesktopAgent.ContextChannels.GetAllChannelsAsync();
            Assert.IsNotNull(channels);
            Assert.IsTrue(channels.Length == 7);
            Assert.IsTrue(!channels.Any(x => x.ChannelType != Channels.ChannelType.Global));
        }

        [TestMethod]
        public async Task GetChannelAsync_CallWithIdentity_ReturnsIdentitysChannel()
        {
            init();

            var identity = new Identity { Name = "test", Uuid = "test" };
            var channels = await DesktopAgent.ContextChannels.GetAllChannelsAsync();
            var rIx = new Random().Next(0, channels.Length - 1);

            await DesktopAgent.ContextChannels.JoinChannelAsync(channels[rIx].Id, identity);

            var channel = await DesktopAgent.ContextChannels.GetChannelAsync(identity);

            Assert.AreEqual(channels[rIx].Id, channel.Id);
        }

        [TestMethod]
        public async Task GetChannelAsync_CallWithoutIdentity_ReturnsGlobalChannel()
        {
            init();

            var result = await DesktopAgent.ContextChannels.GetChannelAsync();

            Assert.IsNotNull(result);
            Assert.AreEqual("global", result.Id);
            Assert.AreEqual("Global", result.Name);
        }

        [TestMethod]
        public async Task GetChannelMembersAsync_GettingChannelMembers_ReturnsValidMemberList()
        {
            init();
            var testChannel = (await DesktopAgent.ContextChannels.GetAllChannelsAsync()).FirstOrDefault();

            Assert.IsNotNull(testChannel);
            var identity1 = new Identity { Name = "window1", Uuid = "testid1" };
            var identity2 = new Identity { Name = "window2", Uuid = "testid2" };

            await DesktopAgent.ContextChannels.JoinChannelAsync(testChannel.Id, identity1);
            await DesktopAgent.ContextChannels.JoinChannelAsync(testChannel.Id, identity2);

            var members = await DesktopAgent.ContextChannels.GetChannelMembersAsync(testChannel.Id);

            Assert.IsNotNull(members);
            Assert.IsTrue(members.Count() == 2);
            Assert.AreEqual(identity1.Uuid, members[0].Uuid);
            Assert.AreEqual(identity1.Name, members[0].Name);
            Assert.AreEqual(identity2.Uuid, members[1].Uuid);
            Assert.AreEqual(identity2.Name, members[1].Name);
        }
        private void init()
        {
            if (DesktopAgent.InitializationComplete == null)
            {
                var tcs = new TaskCompletionSource<object>();

                DesktopAgent.InitializationComplete += ex =>
                {
                    tcs.SetResult(null);
                };

                DesktopAgent.Initialize();

                tcs.Task.Wait();
            }
        }
    }
}
